import { reloadable } from '../utils/tstl-utils';

// Define OverheadAlert constants locally if missing
const OVERHEAD_ALERT_GOLD = 0;
const OVERHEAD_ALERT_DAMAGE = 6;

@reloadable
export class EconomySystem {
    private static instance: EconomySystem;

    // Constants for KV Drops
    private readonly KV_DROP_COIN = 'CustomDrop_Coin';
    private readonly KV_DROP_FAITH = 'CustomDrop_Faith';
    private readonly KV_DROP_DEFENDER_POINTS = 'CustomDrop_DefenderPoints';

    public constructor() {
        this.Initialize();
    }

    public static GetInstance(): EconomySystem {
        if (!this.instance) {
            this.instance = new EconomySystem();
        }
        return this.instance;
    }

    // Simplified KV cache for relevant keys
    private unitKVCache: { [unitName: string]: { coin: number; faith: number; exp: number; defenderPoints: number } } =
        {};

    private Initialize() {
        // Load Unit KVs
        this.LoadUnitKVs();

        // Listen for Entity Killed
        ListenToGameEvent('entity_killed', event => this.OnEntityKilled(event), undefined);
    }

    private LoadUnitKVs() {
        // Try loading the custom units file directly
        const unitsKV = LoadKeyValues('scripts/npc/custom_units.txt');
        if (unitsKV && typeof unitsKV === 'object') {
            // Check if "XLSXContent" exists, otherwise assume root IS the units map
            let dotaUnits = (unitsKV as any)['XLSXContent'];
            if (!dotaUnits) {
                dotaUnits = unitsKV;
            }

            if (dotaUnits) {
                for (const unitName in dotaUnits) {
                    const data = dotaUnits[unitName];
                    if (data && typeof data === 'object') {
                        const coin = data[this.KV_DROP_COIN] ? Number(data[this.KV_DROP_COIN]) : 0;
                        const faith = data[this.KV_DROP_FAITH] ? Number(data[this.KV_DROP_FAITH]) : 0;
                        const exp = data['HaveLevel'] ? Number(data['HaveLevel']) : 0;
                        const defenderPoints = data[this.KV_DROP_DEFENDER_POINTS]
                            ? Number(data[this.KV_DROP_DEFENDER_POINTS])
                            : 0;

                        if (coin > 0 || faith > 0 || exp > 0 || defenderPoints > 0) {
                            this.unitKVCache[unitName] = { coin, faith, exp, defenderPoints };
                        }
                    }
                }
            }
        } else {
        }
    }

    private GetUnitDropInfo(unitName: string): { coin: number; faith: number; exp: number; defenderPoints: number } {
        // Check cache first
        if (this.unitKVCache[unitName]) {
            return this.unitKVCache[unitName];
        }

        // Default Fallback logic
        return { coin: 10, faith: 0, exp: 0, defenderPoints: 0 };
    }

    /**
     * Initializes a player's economy when they join or spawn
     */
    public InitPlayer(playerId: PlayerID) {
        if (!PlayerResource.IsValidPlayerID(playerId)) return;

        const currentData = CustomNetTables.GetTableValue('economy', `player_${playerId}`);
        if (!currentData) {
            // 初始灵石 200，让玩家可以直接买第一个技能
            this.UpdatePlayerEconomy(playerId, 200, 0, 0);
        }
    }

    public AddSpiritCoin(playerId: PlayerID, amount: number) {
        const stats = this.GetPlayerEconomy(playerId);
        this.UpdatePlayerEconomy(playerId, stats.spirit_coin + amount, stats.faith, stats.defender_points);
    }

    public AddFaith(playerId: PlayerID, amount: number) {
        const stats = this.GetPlayerEconomy(playerId);
        this.UpdatePlayerEconomy(playerId, stats.spirit_coin, stats.faith + amount, stats.defender_points);
    }

    public AddDefenderPoints(playerId: PlayerID, amount: number) {
        const stats = this.GetPlayerEconomy(playerId);
        this.UpdatePlayerEconomy(playerId, stats.spirit_coin, stats.faith, stats.defender_points + amount);
    }

    public GetSpiritCoin(playerId: PlayerID): number {
        return this.GetPlayerEconomy(playerId).spirit_coin;
    }

    public GetFaith(playerId: PlayerID): number {
        return this.GetPlayerEconomy(playerId).faith;
    }

    public GetDefenderPoints(playerId: PlayerID): number {
        return this.GetPlayerEconomy(playerId).defender_points;
    }

    private GetPlayerEconomy(playerId: PlayerID): { spirit_coin: number; faith: number; defender_points: number } {
        const data = CustomNetTables.GetTableValue('economy', `player_${playerId}`) as
            | { spirit_coin: number; faith: number; defender_points?: number }
            | undefined;
        return {
            spirit_coin: data?.spirit_coin ?? 0,
            faith: data?.faith ?? 0,
            defender_points: data?.defender_points ?? 0,
        };
    }

    private UpdatePlayerEconomy(playerId: PlayerID, coin: number, faith: number, defenderPoints: number) {
        const data = { spirit_coin: coin, faith: faith, defender_points: defenderPoints };
        CustomNetTables.SetTableValue('economy', `player_${playerId}`, data);

        // Instant Event Update to bypass NetTable throttling
        const player = PlayerResource.GetPlayer(playerId);
        if (player) {
            CustomGameEventManager.Send_ServerToPlayer(
                player,
                'economy_update' as never,
                {
                    player_id: playerId,
                    spirit_coin: coin,
                    faith: faith,
                    defender_points: defenderPoints,
                } as never
            );
        }
    }

    private OnEntityKilled(event: EntityKilledEvent) {
        const killedUnit = EntIndexToHScript(event.entindex_killed) as CDOTA_BaseNPC;
        const attackerUnit = EntIndexToHScript(event.entindex_attacker) as CDOTA_BaseNPC;

        if (!killedUnit || !attackerUnit) return;

        // Ensure attacker is a player hero (or owned by one)
        const playerId = attackerUnit.GetPlayerOwnerID();
        if (playerId < 0) return;

        const info = this.GetUnitDropInfo(killedUnit.GetUnitName());

        // Apply Rewards
        if (info.coin > 0) {
            this.AddSpiritCoin(playerId, info.coin);
            // Hijack the native gold overhead alert to show Spirit Coin gain
            this.ShowOverheadMsg(attackerUnit, info.coin, 'OVERHEAD_ALERT_GOLD');
        }

        if (info.faith > 0) {
            this.AddFaith(playerId, info.faith);
            // Use damage alert (red numbers) for Faith to differentiate
            this.ShowOverheadMsg(attackerUnit, info.faith, 'OVERHEAD_ALERT_DAMAGE');
        }

        // 添加守家积分（战魂）
        if (info.defenderPoints > 0) {
            this.AddDefenderPoints(playerId, info.defenderPoints);
        }

        // 添加经验值 - 使用自定义经验系统（完全绕过Dota2的30级限制）
        if (info.exp > 0) {
            const hero = PlayerResource.GetSelectedHeroEntity(playerId);
            if (hero && !hero.IsNull()) {
                // 导入 CustomStats（如果需要）
                const { CustomStats } = require('../systems/CustomStats');
                CustomStats.AddCustomExp(hero, info.exp);
            }
        }
    }

    private ShowOverheadMsg(unit: CDOTA_BaseNPC, value: number, type: 'OVERHEAD_ALERT_GOLD' | 'OVERHEAD_ALERT_DAMAGE') {
        const player = unit.GetPlayerOwner();

        let msgType = OVERHEAD_ALERT_GOLD;
        if (type === 'OVERHEAD_ALERT_DAMAGE') msgType = OVERHEAD_ALERT_DAMAGE;

        SendOverheadEventMessage(player, msgType, unit, value, player);
    }
}
