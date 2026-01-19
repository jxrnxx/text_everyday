import { reloadable } from '../utils/tstl-utils';

interface TrainingData {
    roomState: boolean;
    liveMonsters: EntityIndex[]; // Store Entity Indices to avoid leaking handles
    spawnCount: number;
    tier: number;
    merchantIndex: EntityIndex | null; // Track merchant for this player
}

@reloadable
export class TrainingManager {
    private static instance: TrainingManager;

    // Data Structures
    private playerData: Map<PlayerID, TrainingData> = new Map();
    private spawnTimer: Map<PlayerID, string> = new Map();

    private readonly MONSTER_UNIT_NAME = 'npc_enemy_zombie_lvl1';
    private readonly MERCHANT_UNIT_NAME = 'npc_cultivation_merchant';
    private readonly MAX_MONSTERS_DEFAULT = 5;

    public static GetInstance(): TrainingManager {
        if (!this.instance) {
            this.instance = new TrainingManager();
        }
        return this.instance;
    }

    public constructor() {
        this.Initialize();
    }

    private Initialize() {
        ListenToGameEvent('entity_killed', event => this.OnEntityKilled(event), undefined);
    }

    private GetPlayerData(playerId: PlayerID): TrainingData {
        let data = this.playerData.get(playerId);
        if (!data) {
            data = {
                roomState: false,
                liveMonsters: [],
                spawnCount: this.MAX_MONSTERS_DEFAULT,
                tier: 1,
                merchantIndex: null,
            };
            this.playerData.set(playerId, data);
        }
        return data;
    }

    /**
     * Sends the player to their training room and starts the spawn loop.
     */
    public EnterRoom(playerId: PlayerID) {
        if (!PlayerResource.IsValidPlayerID(playerId)) return;

        const hero = PlayerResource.GetSelectedHeroEntity(playerId);
        if (!hero || !hero.IsAlive()) {
            return;
        }

        const data = this.GetPlayerData(playerId);

        // Teleport to Room
        const teleportPointName = `point_room_${playerId + 1}`;
        const teleportPoint = Entities.FindByName(undefined, teleportPointName);

        if (teleportPoint) {
            const origin = teleportPoint.GetAbsOrigin();
            FindClearSpaceForUnit(hero, origin, true);
            hero.Stop(); // Stop current actions

            // Camera
            PlayerResource.SetCameraTarget(playerId, hero);
            Timers.CreateTimer(0.1, () => {
                PlayerResource.SetCameraTarget(playerId, undefined);
            });

            // Update State
            data.roomState = true;

            // Spawn Merchant if not already exists
            this.SpawnMerchant(playerId);

            // Start Spawn Loop immediately
            this.CheckAndSpawn(playerId);
        }
    }

    /**
     * Returns the player to base and cleans up the room.
     */
    public ExitRoom(playerId: PlayerID) {
        if (!PlayerResource.IsValidPlayerID(playerId)) return;

        const hero = PlayerResource.GetSelectedHeroEntity(playerId);
        const data = this.GetPlayerData(playerId);

        // Teleport to Base (F4)
        const spawnPointName = `start_player_${playerId + 1}`;
        const spawnPoint = Entities.FindByName(undefined, spawnPointName);

        if (spawnPoint && hero && hero.IsAlive()) {
            const origin = spawnPoint.GetAbsOrigin();
            FindClearSpaceForUnit(hero, origin, true);
            hero.Stop();

            // Camera reset
            PlayerResource.SetCameraTarget(playerId, hero);
            Timers.CreateTimer(0.1, () => {
                PlayerResource.SetCameraTarget(playerId, undefined);
            });
        }

        // Update State
        data.roomState = false;

        // Performance Cleanup
        this.CleanupRoom(playerId);
    }

    /**
     * Core Loop: Wave-based Spawning
     */
    private CheckAndSpawn(playerId: PlayerID) {
        const data = this.GetPlayerData(playerId);

        // Stop if player left room
        if (!data.roomState) {
            return;
        }

        // 1. Cleanup Dead/Invalid References
        // Filter out invalid entities
        data.liveMonsters = data.liveMonsters.filter(entIndex => {
            const unit = EntIndexToHScript(entIndex) as CDOTA_BaseNPC;
            return unit && !unit.IsNull() && unit.IsAlive();
        });

        let nextCheckDelay = 0.5; // Default check interval (waiting for clear)

        // 2. Check Condition: Only spawn if ROOM IS EMPTY
        if (data.liveMonsters.length === 0) {
            const spawnerName = `spawner_room_${playerId + 1}`;
            const spawner = Entities.FindByName(undefined, spawnerName);

            if (spawner) {
                const spawnPos = spawner.GetAbsOrigin();
                const hero = PlayerResource.GetSelectedHeroEntity(playerId);

                // Spawn full wave
                for (let i = 0; i < data.spawnCount; i++) {
                    const monster = CreateUnitByName(
                        this.MONSTER_UNIT_NAME,
                        spawnPos,
                        true,
                        undefined,
                        undefined,
                        DotaTeam.BADGUYS
                    );
                    if (monster) {
                        monster.SetAcquisitionRange(1000);
                        data.liveMonsters.push(monster.entindex()); // Store Index

                        // Force Attack Hero
                        if (hero) {
                            monster.SetForceAttackTarget(hero);
                        }
                    }
                }
                nextCheckDelay = 1.0; // Wait longer after a fresh spawn
            }
        }

        // 3. Schedule next check
        const timerId = Timers.CreateTimer(nextCheckDelay, () => {
            this.CheckAndSpawn(playerId);
            return undefined;
        });

        this.spawnTimer.set(playerId, timerId);
    }

    private CleanupRoom(playerId: PlayerID) {
        // 1. Stop Timer
        const timerId = this.spawnTimer.get(playerId);
        if (timerId) {
            Timers.RemoveTimer(timerId);
            this.spawnTimer.delete(playerId);
        }

        // 2. Access Monsters directly and REMOVE them
        const data = this.GetPlayerData(playerId);

        for (const entIndex of data.liveMonsters) {
            const unit = EntIndexToHScript(entIndex) as CDOTA_BaseNPC;
            if (unit && !unit.IsNull()) {
                unit.RemoveSelf(); // Poof! Gone.
            }
        }
        data.liveMonsters = []; // Clear array
    }

    private OnEntityKilled(event: EntityKilledEvent) {
        const killedUnit = EntIndexToHScript(event.entindex_killed) as CDOTA_BaseNPC;
        if (!killedUnit || !killedUnit.IsRealHero()) return;

        const playerId = killedUnit.GetPlayerID();
        const data = this.GetPlayerData(playerId);
        if (data.roomState) {
            this.ExitRoom(playerId);
        }
    }

    /**
     * API: Increase the spawn count for a player
     */
    public UpgradeSpawnCount(playerId: PlayerID, amount: number) {
        const data = this.GetPlayerData(playerId);
        data.spawnCount += amount;
    }

    // ===== MERCHANT MANAGEMENT =====

    /**
     * Spawn a merchant NPC for the player at their designated shop point
     * Only spawns if merchant doesn't already exist
     */
    private SpawnMerchant(playerId: PlayerID) {
        const data = this.GetPlayerData(playerId);

        // Check if merchant already exists
        if (data.merchantIndex !== null) {
            const existingMerchant = EntIndexToHScript(data.merchantIndex) as CDOTA_BaseNPC;
            if (existingMerchant && !existingMerchant.IsNull() && existingMerchant.IsAlive()) {
                return;
            }
        }

        // Find spawn point: point_shop_1, point_shop_2, etc.
        const shopPointName = `point_shop_${playerId + 1}`;
        const shopPoint = Entities.FindByName(undefined, shopPointName);

        if (!shopPoint) {
            return;
        }

        // Spawn merchant NPC
        const spawnPos = shopPoint.GetAbsOrigin();
        const merchant = CreateUnitByName(
            this.MERCHANT_UNIT_NAME,
            spawnPos,
            true,
            undefined,
            undefined,
            DotaTeam.GOODGUYS
        );

        if (merchant) {
            // Set entity name for interaction security: shop_1, shop_2, etc.
            merchant.SetEntityName(`shop_${playerId + 1}`);

            // Make merchant face a reasonable direction (toward center or player)
            const hero = PlayerResource.GetSelectedHeroEntity(playerId);
            if (hero) {
                const heroPos = hero.GetAbsOrigin();
                const direction = ((heroPos - spawnPos) as Vector).Normalized();
                merchant.SetForwardVector(direction);
            }

            // Persistent idle animation loop (survives alt-tab)
            merchant.SetContextThink(
                'MerchantIdleAnim',
                () => {
                    if (merchant && !merchant.IsNull() && merchant.IsAlive()) {
                        merchant.StartGesture(GameActivity.DOTA_IDLE);
                        return 3.0; // Refresh animation every 3 seconds
                    }
                    return undefined; // Stop if merchant is gone
                },
                0
            );

            // Store reference
            data.merchantIndex = merchant.entindex();
        }
    }

    /**
     * Remove a player's merchant (called when leaving or cleaning up)
     */
    private RemoveMerchant(playerId: PlayerID) {
        const data = this.GetPlayerData(playerId);

        if (data.merchantIndex !== null) {
            const merchant = EntIndexToHScript(data.merchantIndex) as CDOTA_BaseNPC;
            if (merchant && !merchant.IsNull()) {
                merchant.RemoveSelf();
            }
            data.merchantIndex = null;
        }
    }
}
