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
    private unitKVCache: { [unitName: string]: { coin: number; faith: number; exp: number } } = {};

    private Initialize() {
        // Load Unit KVs
        this.LoadUnitKVs();

        // Listen for Entity Killed
        ListenToGameEvent('entity_killed', event => this.OnEntityKilled(event), undefined);

        print('[EconomySystem] Initialized');
    }

    private LoadUnitKVs() {
        // Try loading the custom units file directly
        const unitsKV = LoadKeyValues('scripts/npc/custom_units.txt');
        if (unitsKV && typeof unitsKV === 'object') {
            print(`[EconomySystem] Loaded KV Object Keys: ${Object.keys(unitsKV).join(', ')}`);

            // Check if "XLSXContent" exists, otherwise assume root IS the units map
            let dotaUnits = (unitsKV as any)['XLSXContent'];
            if (!dotaUnits) {
                print("[EconomySystem] 'XLSXContent' key not found, assuming root object contains units.");
                dotaUnits = unitsKV;
            }

            if (dotaUnits) {
                for (const unitName in dotaUnits) {
                    const data = dotaUnits[unitName];
                    if (data && typeof data === 'object') {
                        const coin = data[this.KV_DROP_COIN] ? Number(data[this.KV_DROP_COIN]) : 0;
                        const faith = data[this.KV_DROP_FAITH] ? Number(data[this.KV_DROP_FAITH]) : 0;
                        const exp = data['HaveLevel'] ? Number(data['HaveLevel']) : 0;

                        // print(`[EconomySystem] Checking Unit: ${unitName} -> Coin: ${coin}, Faith: ${faith}`, Exp: ${exp});

                        if (coin > 0 || faith > 0 || exp > 0) {
                            this.unitKVCache[unitName] = { coin, faith, exp };
                        }
                    }
                }
            }
            print(`[EconomySystem] Loaded KV drops for ${Object.keys(this.unitKVCache).length} units.`);
        } else {
            print(`[EconomySystem] Warning: Failed to load scripts/npc/npc_units_custom.txt`);
        }
    }

    private GetUnitDropInfo(unitName: string): { coin: number; faith: number; exp: number } {
        // Check cache first
        if (this.unitKVCache[unitName]) {
            return this.unitKVCache[unitName];
        }

        // Default Fallback logic
        // 1. If it's a hero? Maybe drops nothing by default or huge bounty.
        // 2. If it is a generic creep (has 'npc_dota_creature' class but no custom KV?), give 10 coins.
        return { coin: 10, faith: 0, exp: 0 };
    }

    // ... (rest of methods)

    /**
     * Initializes a player's economy when they join or spawn
     */
    public InitPlayer(playerId: PlayerID) {
        if (!PlayerResource.IsValidPlayerID(playerId)) return;

        const currentData = CustomNetTables.GetTableValue('economy', `player_${playerId}`);
        if (!currentData) {
            // 初始灵石 200，让玩家可以直接买第一个技能
            this.UpdatePlayerEconomy(playerId, 200, 0);
        }
    }

    public AddSpiritCoin(playerId: PlayerID, amount: number) {
        const stats = this.GetPlayerEconomy(playerId);
        this.UpdatePlayerEconomy(playerId, stats.spirit_coin + amount, stats.faith);
    }

    public AddFaith(playerId: PlayerID, amount: number) {
        const stats = this.GetPlayerEconomy(playerId);
        this.UpdatePlayerEconomy(playerId, stats.spirit_coin, stats.faith + amount);
    }

    public GetSpiritCoin(playerId: PlayerID): number {
        return this.GetPlayerEconomy(playerId).spirit_coin;
    }

    public GetFaith(playerId: PlayerID): number {
        return this.GetPlayerEconomy(playerId).faith;
    }

    private GetPlayerEconomy(playerId: PlayerID): { spirit_coin: number; faith: number } {
        const data = CustomNetTables.GetTableValue('economy', `player_${playerId}`);
        return data || { spirit_coin: 0, faith: 0 };
    }

    private UpdatePlayerEconomy(playerId: PlayerID, coin: number, faith: number) {
        const data = { spirit_coin: coin, faith: faith };
        CustomNetTables.SetTableValue('economy', `player_${playerId}`, data);

        // Instant Event Update to bypass NetTable throttling
        const player = PlayerResource.GetPlayer(playerId);
        if (player) {
            CustomGameEventManager.Send_ServerToPlayer(player, 'economy_update', {
                player_id: playerId,
                spirit_coin: coin,
                faith: faith,
            });
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

        // 添加经验值 - 检查等级上限
        if (info.exp > 0) {
            const hero = PlayerResource.GetSelectedHeroEntity(playerId);
            if (hero && !hero.IsNull()) {
                const currentLevel = hero.GetLevel();
                
                // 突破等级点: 10, 20, 30, 40, 50
                // 阶位 0 = 上限 10, 阶位 1 = 上限 20, 阶位 2 = 上限 30...
                const heroIndex = hero.GetEntityIndex();
                const statsData = CustomNetTables.GetTableValue('custom_stats' as any, tostring(heroIndex));
                const rank = (statsData as any)?.rank || 0;
                const levelCap = (rank + 1) * 10;
                
                // 如果当前等级已经到达上限，不再添加经验
                if (currentLevel >= levelCap) {
                    // 可选：显示提示消息
                    // print(`[EconomySystem] Level cap reached: ${currentLevel}/${levelCap}, need breakthrough`);
                    return;
                }
                
                hero.AddExperience(info.exp, ModifyXpReason.UNSPECIFIED, false, true);
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
