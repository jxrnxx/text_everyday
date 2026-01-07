import { EconomySystem } from './mechanics/EconomySystem';
import { TrainingManager } from './systems/TrainingManager';
import { CustomStats } from './systems/CustomStats';
import './modifiers/modifier_custom_stats_handler';
import './items/item_buy_stats';

// 游戏模式类
export class GameMode {
    private static isGameStarted = false;
    private static get currentWaveTimer(): string | null {
        return (GameRules as any)._CurrentWaveTimer || null;
    }

    private static set currentWaveTimer(value: string | null) {
        (GameRules as any)._CurrentWaveTimer = value;
    }

    public static Activate() {
        GameRules.SetCustomGameTeamMaxPlayers(DotaTeam.GOODGUYS, 4);
        GameRules.SetCustomGameTeamMaxPlayers(DotaTeam.BADGUYS, 0);
        SendToConsole('sv_cheats 1'); // 确保 restart 指令可用

        GameRules.SetPreGameTime(0);
        GameRules.SetHeroSelectionTime(0);
        GameRules.SetStrategyTime(0);
        GameRules.GetGameModeEntity().SetCustomGameForceHero('npc_dota_hero_juggernaut');
        GameRules.GetGameModeEntity().SetFogOfWarDisabled(true);
        GameRules.GetGameModeEntity().SetCameraDistanceOverride(1450); // 调整镜头高度

        // [Economy] Disable native gold
        GameRules.SetGoldTickTime(99999);
        GameRules.SetGoldPerTick(0);

        // [Economy] Initialize Custom Economy System
        EconomySystem.GetInstance();

        ListenToGameEvent('npc_spawned', event => this.OnNpcSpawned(event), undefined);

        // 监听聊天指令
        ListenToGameEvent(
            'player_chat',
            event => {
                const text = event.text.toLowerCase();
                if (text === 'r' || text === 'restart') {
                    // print("[GameMode] 收到指令: 执行全量重启 (restart)");
                    SendToConsole('restart');
                }
            },
            undefined
        );

        // [Training] Register Console Test Commands
        ListenToGameEvent(
            'player_chat',
            event => {
                const text = event.text.toLowerCase().trim();
                const playerId = event.playerid;

                if (text === 'cmd_train_enter') {
                    TrainingManager.GetInstance().EnterRoom(playerId);
                }

                if (text === 'cmd_train_exit') {
                    TrainingManager.GetInstance().ExitRoom(playerId);
                }
            },
            undefined
        );

        // Register Console Commands for Keybinding (Cross-Layer Solution)
        Convars.RegisterCommand(
            'cmd_train_enter',
            (_, strPlayerId) => {
                const playerId = Number(strPlayerId);
                if (playerId != null && !isNaN(playerId)) {
                    TrainingManager.GetInstance().EnterRoom(playerId as PlayerID);
                }
            },
            'Enter Training Room',
            0
        );

        Convars.RegisterCommand(
            'cmd_train_exit',
            (_, strPlayerId) => {
                const playerId = Number(strPlayerId);
                if (playerId != null && !isNaN(playerId)) {
                    TrainingManager.GetInstance().ExitRoom(playerId as PlayerID);
                }
            },
            'Exit Training Room',
            0
        );

        // [Training] Listen for F3/F4 Key Events from Panorama
        CustomGameEventManager.RegisterListener('cmd_c2s_train_enter', (_, event) => {
            const playerID = (event as any).PlayerID as PlayerID;
            print(`[GameMode] Received F3 Event from Player ${playerID}`);
            TrainingManager.GetInstance().EnterRoom(playerID);
        });

        CustomGameEventManager.RegisterListener('cmd_c2s_train_exit', (_, event) => {
            const playerID = (event as any).PlayerID as PlayerID;
            print(`[GameMode] Received F4 Event from Player ${playerID}`);
            TrainingManager.GetInstance().ExitRoom(playerID);
        });

        // 监听前端验证码请求
        CustomGameEventManager.RegisterListener('to_server_verify_code', (_, event) => {
            const playerID = (event as any).PlayerID as PlayerID;
            const code = (event as any).code;
            const player = PlayerResource.GetPlayer(playerID);

            if (player) {
                if (code === '1' || code === '669571') {
                    // print(`[GameMode] 玩家 ${playerID} 验证通过`);
                    CustomGameEventManager.Send_ServerToPlayer(player, 'from_server_verify_result', {
                        success: true,
                        message: '验证成功',
                    });

                    // 验证通过后，如果游戏还没开始，则开始游戏
                    if (!this.isGameStarted) {
                        this.StartGame();
                    }
                } else {
                    CustomGameEventManager.Send_ServerToPlayer(player, 'from_server_verify_result', {
                        success: false,
                        message: '验证码错误，请输入: 1',
                    });
                }
            }
        });

        // print("[GameMode] 游戏模式已激活: 等待验证...");

        // 如果是重新加载脚本 (游戏已经在进行中)，则自动执行一次软重启以应用新逻辑
        if (GameRules.State_Get() >= 4) {
            // 4 = DOTA_GAMERULES_STATE_PRE_GAME
            // print("[GameMode] 检测到脚本重载，自动执行 RestartGame...");
            this.RestartGame();
        }
    }

    // 开始游戏逻辑
    private static StartGame() {
        if (this.isGameStarted) return;
        this.isGameStarted = true;
        // print("[GameMode] 游戏正式开始！启动刷怪和计时...");

        // 通知前端开始计时 (修正时间显示)
        CustomGameEventManager.Send_ServerToAllClients('update_game_timer_start', {
            startTime: GameRules.GetGameTime(),
        });

        // 延迟3秒后开始第一波 (给玩家一点准备时间)
        this.currentWaveTimer = Timers.CreateTimer(3, () => {
            this.StartWave(1);
            return undefined;
        });
    }

    // 重置游戏 (软重启)
    private static RestartGame() {
        print('[GameMode] 执行软重启...');
        this.isGameStarted = false;

        // 1. 停止当前刷怪计时器
        if (this.currentWaveTimer) {
            Timers.RemoveTimer(this.currentWaveTimer);
            this.currentWaveTimer = null;
        }

        // 2. 清理所有怪物
        const enemies = Entities.FindAllByClassname('npc_dota_creature');
        for (const enemy of enemies) {
            if (enemy && !enemy.IsNull() && enemy.IsAlive()) {
                const npc = enemy as CDOTA_BaseNPC; // 显式转换
                npc.ForceKill(false);
                npc.AddNoDraw(); // 立即隐藏尸体
            }
        }

        // 3. 重置玩家英雄状态和位置
        for (let i = 0; i <= 3; i++) {
            const playerID = i as PlayerID; // 显式转换
            const hero = PlayerResource.GetSelectedHeroEntity(playerID);
            if (hero) {
                hero.RespawnHero(false, false);
                hero.SetHealth(hero.GetMaxHealth());
                hero.SetMana(hero.GetMaxMana());

                // 传送回出生点
                const spawnPointName = `start_player_${i + 1}`;
                const spawnPoint = Entities.FindByName(undefined, spawnPointName);
                if (spawnPoint) {
                    const origin = spawnPoint.GetAbsOrigin();
                    hero.SetAbsOrigin(origin);
                    FindClearSpaceForUnit(hero, origin, true);
                }
            }
        }

        // 4. 发送重置UI事件 (让时间归零)
        CustomGameEventManager.Send_ServerToAllClients('reset_game_timer', {});

        // 5. 重新开始游戏 (可以直接开始，或者让玩家准备一下)
        // 这里我们选择立即重新开始，方便测试
        this.StartGame();
    }

    // NPC出生事件处理
    private static OnNpcSpawned(event: NpcSpawnedEvent) {
        // ... (保持原有逻辑不变，只展示部分)
        const unit = EntIndexToHScript(event.entindex) as CDOTA_BaseNPC;
        if (unit) {
            // [Economy] Disable native gold bounty for all units
            unit.SetMaximumGoldBounty(0);
            unit.SetMinimumGoldBounty(0);
        }

        if (unit.IsRealHero()) {
            unit.SetBaseMoveSpeed(600); // 测试用：设置移速 600

            // [Stats] Initialize Custom Stats
            CustomStats.InitializeHeroStats(unit as CDOTA_BaseNPC_Hero);

            const playerId = unit.GetPlayerOwnerID();
            if (playerId >= 0 && playerId <= 3) {
                // Initialize Economy for this player if not already
                EconomySystem.GetInstance().InitPlayer(playerId);

                // 只有在游戏刚加载时传送，重启时由RestartGame处理
                // 但为了保险，还是保留这个出生传送逻辑
                const spawnPointName = `start_player_${playerId + 1}`;
                const spawnPoint = Entities.FindByName(undefined, spawnPointName);
                if (spawnPoint) {
                    const origin = spawnPoint.GetAbsOrigin();
                    unit.SetAbsOrigin(origin);
                    FindClearSpaceForUnit(unit, origin, true);
                }
            }
        }
    }

    // 开启一波刷怪 (持续1分钟，每0.5秒刷一次)
    private static StartWave(waveNumber: number) {
        if (!this.isGameStarted) return; // 如果游戏重置了，停止刷怪

        // print(`[GameMode] 第 ${waveNumber} 波开始！(持续60秒)`);

        // ... (目标获取逻辑)
        // 优先寻找自定义基地 "npc_dota_home_base"
        let targetEntity = Entities.FindAllByClassname('npc_dota_building').find(e => (e as CDOTA_BaseNPC).GetUnitName() === 'npc_dota_home_base');

        // 如果找不到，尝试找默认基地
        if (!targetEntity) {
            targetEntity = Entities.FindByName(undefined, 'dota_goodguys_fort');
        }

        let targetPos: Vector = Vector(0, 0, 0);

        if (targetEntity) {
            targetPos = targetEntity.GetAbsOrigin();
            // print(`[GameMode DEBUG] 找到基地目标: ${(targetEntity as CDOTA_BaseNPC).GetUnitName() || "dota_goodguys_fort"}, 位置: ${targetPos.x}, ${targetPos.y}, ${targetPos.z}`);

            // 简单的防错：如果是那个诡异的地图角落坐标 (-11712)，说明这个实体可能损坏了，强制归零
            if (targetPos.x < -10000 && targetPos.y < -10000) {
                print(`[GameMode DEBUG] 警告: 目标坐标异常 (可能未放置好)，重置为 (0,0,0)`);
                targetPos = Vector(0, 0, 0);
            }
        } else {
            print(`[GameMode DEBUG] 警告: 未找到 dota_goodguys_fort 或 npc_dota_home_base，尝试查找玩家英雄...`);
            const playerHero = PlayerResource.GetSelectedHeroEntity(0);
            if (playerHero) {
                targetEntity = playerHero;
                targetPos = playerHero.GetAbsOrigin();
                print(`[GameMode DEBUG] 找到英雄目标: ${playerHero.GetUnitName()}, 位置: ${targetPos.x}, ${targetPos.y}, ${targetPos.z}`);
            } else {
                print(`[GameMode DEBUG] 严重警告: 既找不到基地也找不到英雄，怪物将攻击 (0,0,0)`);
                targetPos = Vector(0, 0, 0);
            }
        }

        const duration = 30;
        const interval = 0.8;
        const ticks = duration / interval;
        let currentTick = 0;

        // 启动持续刷怪计时器
        // 启动持续刷怪计时器
        this.currentWaveTimer = Timers.CreateTimer(0, () => {
            if (!this.isGameStarted) {
                this.currentWaveTimer = null;
                return undefined; // 安全检查：游戏重置则停止
            }
            if (currentTick >= ticks) {
                // print(`[GameMode] 第 ${waveNumber} 波结束`);
                this.currentWaveTimer = null;
                return undefined;
            }

            // ... (刷怪循环逻辑)
            for (let i = 1; i <= 3; i++) {
                const spawnerName = `spawner_${i}`;
                const spawner = Entities.FindByName(undefined, spawnerName);
                if (spawner) {
                    const spawnerPos = spawner.GetAbsOrigin();
                    CreateUnitByNameAsync('npc_enemy_zombie_lvl1', spawnerPos, true, undefined, undefined, DotaTeam.BADGUYS, unit => {
                        if (unit) {
                            unit.SetAcquisitionRange(700); // 仇恨范围 700

                            // 强制赋予 AI 思考能力 (优化版：只在必要时干预)
                            unit.SetContextThink(
                                'ZombieThink',
                                () => {
                                    if (unit && !unit.IsNull() && unit.IsAlive()) {
                                        const origin = unit.GetAbsOrigin();
                                        const currentTarget = unit.GetAggroTarget();

                                        // 1. Leash 机制 (防风筝/脱战)
                                        // 引擎自带的 ChaseDistance 往往对自定义单位无效，所以保留这个简单的距离检查
                                        if (currentTarget && currentTarget.IsHero()) {
                                            const dist = CalcDistanceBetweenEntityOBB(unit, currentTarget);
                                            if (dist > 1000) {
                                                // 追太远了，放弃追击，继续去打基地
                                                ExecuteOrderFromTable({
                                                    UnitIndex: unit.entindex(),
                                                    OrderType: UnitOrder.ATTACK_MOVE,
                                                    Position: targetPos,
                                                    Queue: false,
                                                });
                                                return 1.0;
                                            }
                                            return 0.5; // 正在追英雄，检查频率稍微高一点
                                        }

                                        // 2. 只有在攻击基地(建筑)时，才去检测周围有没有英雄
                                        // 这样避免了走路时也一直在搜敌(原生 AttackMove 走路时会自动搜敌)
                                        if (currentTarget && currentTarget.IsBuilding()) {
                                            const enemies = FindUnitsInRadius(
                                                unit.GetTeamNumber(),
                                                origin,
                                                undefined,
                                                800, // 就在这个时候看一眼周围有没有人
                                                UnitTargetTeam.ENEMY,
                                                UnitTargetType.HERO, // 只找英雄
                                                UnitTargetFlags.NONE,
                                                FindOrder.CLOSEST,
                                                false
                                            );

                                            if (enemies.length > 0) {
                                                // 既然在打塔的时候旁边有人，那肯定是玩家来守塔了，转火！
                                                ExecuteOrderFromTable({
                                                    UnitIndex: unit.entindex(),
                                                    OrderType: UnitOrder.ATTACK_TARGET,
                                                    TargetIndex: enemies[0].entindex(),
                                                    Queue: false,
                                                });
                                                return 1.0;
                                            }
                                        }

                                        // 3. 断线重连/发呆补救
                                        // 如果单位当前没有在做什么 (Idle)，才下达命令
                                        if (unit.IsIdle()) {
                                            const canFindPath = GridNav.CanFindPath(origin, targetPos);
                                            if (!canFindPath) {
                                                FindClearSpaceForUnit(unit, origin, true);
                                            }
                                            ExecuteOrderFromTable({
                                                UnitIndex: unit.entindex(),
                                                OrderType: UnitOrder.ATTACK_MOVE,
                                                Position: targetPos,
                                                Queue: false,
                                            });
                                        }
                                        return 1.0;
                                    }
                                    return undefined;
                                },
                                0.1
                            );
                        }
                    });
                }
            }

            currentTick++;
            return interval;
        });
    }
}
