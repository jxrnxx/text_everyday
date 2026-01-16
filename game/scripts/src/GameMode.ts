import { EconomySystem } from './mechanics/EconomySystem';
import { TrainingManager } from './systems/TrainingManager';
import { CustomStats } from './systems/CustomStats';
import { RankSystem } from './systems/RankSystem';
import { UpgradeSystem } from './systems/UpgradeSystem';
import { WaveManager } from './systems/WaveManager';
import './modifiers/modifier_custom_stats_handler';
import './items/item_buy_stats';
import { ExecuteDash, ExecuteDashFromCommand } from './abilities/blink_dash';
import * as json_heroes from './json/npc_heroes_custom.json';

// 游戏模式类
export class GameMode {
    private static isGameStarted = false;
    private static selectedHeroes: { [playerID: number]: string } = {};  // 玩家选择的英雄
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

        // 监听游戏状态变化，自动分配玩家到队伍
        ListenToGameEvent('game_rules_state_change', () => {
            const state = GameRules.State_Get();
            // 在队伍选择阶段自动分配玩家
            if (state === GameState.CUSTOM_GAME_SETUP) {
                // 自动将所有玩家分配到天辉队伍
                for (let i = 0; i < 4; i++) {
                    const playerId = i as PlayerID;
                    if (PlayerResource.IsValidPlayer(playerId)) {
                        PlayerResource.SetCustomTeamAssignment(playerId, DotaTeam.GOODGUYS);
                    }
                }
                // 锁定队伍并开始游戏
                Timers.CreateTimer(0.1, () => {
                    GameRules.LockCustomGameSetupTeamAssignment(true);
                    GameRules.FinishCustomGameSetup();
                    return undefined;
                });
            }
        }, undefined);

        GameRules.SetPreGameTime(0);
        GameRules.SetHeroSelectionTime(0);  // 跳过原生英雄选择界面
        GameRules.SetStrategyTime(0);
        GameRules.SetShowcaseTime(0);
        
        // 英雄选择流程说明：
        // 1. ForceHero 设置默认英雄（剑圣），跳过原生选择界面
        // 2. 验证码界面输入 1=剑圣, 2=玛西
        // 3. 如果选择不同英雄，RestartGame 后生成正确英雄
        
        const gameMode = GameRules.GetGameModeEntity();
        gameMode.SetCustomGameForceHero('npc_dota_hero_juggernaut');
        gameMode.SetFogOfWarDisabled(true);
        gameMode.SetCameraDistanceOverride(1450);
        
        // [Economy] Disable native gold & XP
        GameRules.SetGoldTickTime(99999);
        GameRules.SetGoldPerTick(0);
        
        // [XP] 使用自定义经验值系统
        GameRules.SetUseCustomHeroXPValues(true);
        
        // [Level Cap] 解锁最高50级 (Dota2默认最高30级)
        // 需要通过 GameMode 设置自定义等级表
        gameMode.SetUseCustomHeroLevels(true);
        gameMode.SetCustomHeroMaxLevel(50);
        
        // 设置自定义经验表 (每级所需经验)
        // 索引从0开始，表示从1级升到2级所需的经验
        const customXPPerLevel = [
            230,    // 1 -> 2
            370,    // 2 -> 3
            480,    // 3 -> 4
            580,    // 4 -> 5
            600,    // 5 -> 6
            720,    // 6 -> 7
            750,    // 7 -> 8
            890,    // 8 -> 9
            930,    // 9 -> 10
            970,    // 10 -> 11
            1010,   // 11 -> 12
            1050,   // 12 -> 13
            1225,   // 13 -> 14
            1250,   // 14 -> 15
            1275,   // 15 -> 16
            1300,   // 16 -> 17
            1325,   // 17 -> 18
            1500,   // 18 -> 19
            1590,   // 19 -> 20
            1600,   // 20 -> 21
            1850,   // 21 -> 22
            2100,   // 22 -> 23
            2350,   // 23 -> 24
            2600,   // 24 -> 25
            3500,   // 25 -> 26
            4500,   // 26 -> 27
            5500,   // 27 -> 28
            6500,   // 28 -> 29
            7500,   // 29 -> 30
            8000,   // 30 -> 31
            8500,   // 31 -> 32
            9000,   // 32 -> 33
            9500,   // 33 -> 34
            10000,  // 34 -> 35
            10500,  // 35 -> 36
            11000,  // 36 -> 37
            11500,  // 37 -> 38
            12000,  // 38 -> 39
            12500,  // 39 -> 40
            13000,  // 40 -> 41
            13500,  // 41 -> 42
            14000,  // 42 -> 43
            14500,  // 43 -> 44
            15000,  // 44 -> 45
            15500,  // 45 -> 46
            16000,  // 46 -> 47
            16500,  // 47 -> 48
            17000,  // 48 -> 49
            17500,  // 49 -> 50
        ];
        gameMode.SetCustomXPRequiredToReachNextLevel(customXPPerLevel);

        // [Economy] Initialize Custom Economy System
        EconomySystem.GetInstance();
        
        // [Stats] Initialize Custom Server Event Listeners
        try {
            CustomStats.Init();
        } catch (e) {
            print(`[GameMode] FAILED TO INIT CUSTOM STATS: ${e}`);
        }

        // [Rank] Initialize Rank System
        try {
            RankSystem.GetInstance();
        } catch (e) {
            print(`[GameMode] FAILED TO INIT RANK SYSTEM: ${e}`);
        }

        // [Upgrade] Initialize Upgrade System
        try {
            UpgradeSystem.GetInstance();
        } catch (e) {
            print(`[GameMode] FAILED TO INIT UPGRADE SYSTEM: ${e}`);
        }

        // [Level] 监听英雄升级事件，更新显示等级
        ListenToGameEvent('dota_player_gained_level', (event) => {
            const playerId = event.player_id;
            const player = PlayerResource.GetPlayer(playerId);
            if (!player) return;
            
            const hero = player.GetAssignedHero();
            if (!hero) return;
            
            const stats = CustomStats.GetAllStats(hero);
            const rawLevel = hero.GetLevel();
            const currentMaxLevel = (stats.rank + 1) * 10;
            
            // 只有当实际等级没超过当前阶位最大等级时，才更新显示等级
            if (rawLevel <= currentMaxLevel && rawLevel > stats.display_level) {
                CustomStats.SetDisplayLevel(hero, rawLevel);
            }
        }, undefined);

        // [XP Filter] Block XP gain if at level cap (Rule A)
        GameRules.GetGameModeEntity().SetModifyExperienceFilter(
            (event: ModifyExperienceFilterEvent) => this.XPFilter(event),
            this
        );

        // [Damage Filter] Apply armor penetration (破势)
        GameRules.GetGameModeEntity().SetDamageFilter(
            (event: DamageFilterEvent) => this.DamageFilter(event),
            this
        );


        // [Merchant] Listen for NPC interactions (Interaction Security)
        ListenToGameEvent('dota_player_used_ability', () => {}, undefined); // Placeholder
        ListenToGameEvent('dota_player_update_hero_selection', () => {}, undefined); // Placeholder
        
        // Actually listen to entity interactions via console command workaround
        // Since dota_player_interact_npc isn't a standard event, we use custom command
        Convars.RegisterCommand(
            'cmd_interact_merchant',
            (_, strPlayerId, entityName) => {
                const playerId = Number(strPlayerId) as PlayerID;
                this.OnMerchantInteract(playerId, entityName);
            },
            'Merchant Interaction Handler',
            0
        );

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

        // [Debug] 调试命令监听器
        ListenToGameEvent(
            'player_chat',
            event => {
                const text = event.text.toLowerCase().trim();
                const playerId = event.playerid as PlayerID;
                const player = PlayerResource.GetPlayer(playerId);
                const hero = player?.GetAssignedHero();

                // -skip: 跳过当前计时器，立即开始下一波
                if (text === '-skip') {
                    WaveManager.GetInstance().SkipToNextWave();
                    print(`[Debug] Player ${playerId} skipped wave timer`);
                    return;
                }

                // -wave <number>: 跳转到指定波次
                if (text.startsWith('-wave ')) {
                    const waveNum = parseInt(text.substring(6));
                    if (!isNaN(waveNum) && waveNum >= 1 && waveNum <= 20) {
                        WaveManager.GetInstance().JumpToWave(waveNum);
                        print(`[Debug] Jumping to Wave ${waveNum}...`);
                    }
                    return;
                }

                // -killall: 杀死所有敌方单位
                if (text === '-killall') {
                    const enemies = Entities.FindAllByClassname('npc_dota_creature');
                    let killCount = 0;
                    for (const enemy of enemies) {
                        if (enemy && !enemy.IsNull()) {
                            const unit = enemy as CDOTA_BaseNPC;
                            if (unit.GetTeamNumber() === DotaTeam.BADGUYS && unit.IsAlive()) {
                                unit.ForceKill(false);
                                killCount++;
                            }
                        }
                    }
                    print(`[Debug] Killed ${killCount} enemy units`);
                    return;
                }

                // -lvlup <number>: 升级指定等级
                if (text.startsWith('-lvlup')) {
                    if (!hero) return;
                    const parts = text.split(' ');
                    const levels = parts.length > 1 ? parseInt(parts[1]) : 1;
                    if (!isNaN(levels) && levels > 0) {
                        for (let i = 0; i < levels; i++) {
                            hero.HeroLevelUp(false);
                        }
                        print(`[Debug] Hero leveled up ${levels} times, now level ${hero.GetLevel()}`);
                    }
                    return;
                }

                // -gold <number>: 添加灵石
                if (text.startsWith('-gold ')) {
                    const amount = parseInt(text.substring(6));
                    if (!isNaN(amount) && amount > 0) {
                        EconomySystem.GetInstance().AddSpiritCoin(playerId, amount);
                        print(`[Debug] Added ${amount} Spirit Coins to player ${playerId}`);
                    }
                    return;
                }

                // -faith <number>: 添加信仰值
                if (text.startsWith('-faith ')) {
                    const amount = parseInt(text.substring(7));
                    if (!isNaN(amount) && amount > 0) {
                        EconomySystem.GetInstance().AddFaith(playerId, amount);
                        print(`[Debug] Added ${amount} Faith to player ${playerId}`);
                    }
                    return;
                }
            },
            undefined
        );

        // [CustomChat] 处理自定义聊天消息（F5 聊天框）
        CustomGameEventManager.RegisterListener('to_server_chat_message' as any, (_, event) => {
            const playerId = (event as any).PlayerID as PlayerID;
            const message = (event as any).message as string;
            
            if (!message) return;
            
            const text = message.toLowerCase().trim();
            const player = PlayerResource.GetPlayer(playerId);
            const hero = player?.GetAssignedHero();
            
            // 处理调试命令
            if (text === '-skip') {
                WaveManager.GetInstance().SkipToNextWave();
                print(`[Debug] Player ${playerId} skipped wave timer`);
                return;
            }
            
            if (text.startsWith('-wave ')) {
                const waveNum = parseInt(text.substring(6));
                if (!isNaN(waveNum) && waveNum >= 1 && waveNum <= 20) {
                    WaveManager.GetInstance().JumpToWave(waveNum);
                    print(`[Debug] Jumping to Wave ${waveNum}...`);
                }
                return;
            }
            
            if (text === '-killall') {
                const enemies = Entities.FindAllByClassname('npc_dota_creature');
                let killCount = 0;
                for (const enemy of enemies) {
                    if (enemy && !enemy.IsNull()) {
                        const unit = enemy as CDOTA_BaseNPC;
                        if (unit.GetTeamNumber() === DotaTeam.BADGUYS && unit.IsAlive()) {
                            unit.ForceKill(false);
                            killCount++;
                        }
                    }
                }
                print(`[Debug] Killed ${killCount} enemies`);
                return;
            }
            
            if (text.startsWith('-lvlup')) {
                if (!hero) return;
                const parts = text.split(' ');
                const levels = parts.length > 1 ? parseInt(parts[1]) : 1;
                if (!isNaN(levels) && levels > 0) {
                    for (let i = 0; i < levels; i++) {
                        hero.HeroLevelUp(false);
                    }
                    print(`[Debug] Hero leveled up ${levels} times`);
                }
                return;
            }
            
            if (text.startsWith('-gold ')) {
                const amount = parseInt(text.substring(6));
                if (!isNaN(amount) && amount > 0) {
                    EconomySystem.GetInstance().AddSpiritCoin(playerId, amount);
                    print(`[Debug] Added ${amount} Spirit Coins`);
                }
                return;
            }
            
            if (text.startsWith('-faith ')) {
                const amount = parseInt(text.substring(7));
                if (!isNaN(amount) && amount > 0) {
                    EconomySystem.GetInstance().AddFaith(playerId, amount);
                    print(`[Debug] Added ${amount} Faith`);
                }
                return;
            }
            
            // 普通聊天消息 - 广播给所有玩家
            print(`[Chat] Player ${playerId}: ${message}`);
        });

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

        // [BlinkDash] 注册冲刺控制台命令
        Convars.RegisterCommand(
            'cmd_blink_dash',
            (_, strPlayerId) => {
                const playerId = Number(strPlayerId);
                if (playerId != null && !isNaN(playerId)) {
                    ExecuteDashFromCommand(playerId as PlayerID);
                }
            },
            'Blink Dash',
            0
        );

        // [Debug] 调试控制台命令 - 用 ~ 键打开控制台执行
        Convars.RegisterCommand('debug_skip', () => {
            WaveManager.GetInstance().SkipToNextWave();
            print('[Debug] Skipping to next wave...');
        }, 'Skip to next wave', 0);

        Convars.RegisterCommand('debug_wave', (_, waveNum) => {
            const num = parseInt(waveNum);
            if (!isNaN(num) && num >= 1 && num <= 20) {
                WaveManager.GetInstance().JumpToWave(num);
                print(`[Debug] Jumping to wave ${num}...`);
            }
        }, 'Jump to specific wave', 0);

        Convars.RegisterCommand('debug_killall', () => {
            const enemies = Entities.FindAllByClassname('npc_dota_creature');
            let killCount = 0;
            for (const enemy of enemies) {
                if (enemy && !enemy.IsNull()) {
                    const unit = enemy as CDOTA_BaseNPC;
                    if (unit.GetTeamNumber() === DotaTeam.BADGUYS && unit.IsAlive()) {
                        unit.ForceKill(false);
                        killCount++;
                    }
                }
            }
            print(`[Debug] Killed ${killCount} enemies`);
        }, 'Kill all enemy units', 0);

        Convars.RegisterCommand('debug_lvlup', (_, levels) => {
            const hero = PlayerResource.GetSelectedHeroEntity(0 as PlayerID);
            if (!hero) return;
            const num = parseInt(levels) || 1;
            for (let i = 0; i < num; i++) {
                hero.HeroLevelUp(false);
            }
            print(`[Debug] Hero leveled up ${num} times, now level ${hero.GetLevel()}`);
        }, 'Level up hero', 0);

        Convars.RegisterCommand('debug_gold', (_, amount) => {
            const num = parseInt(amount) || 9999;
            EconomySystem.GetInstance().AddSpiritCoin(0 as PlayerID, num);
            print(`[Debug] Added ${num} Spirit Coins`);
        }, 'Add spirit coins', 0);

        Convars.RegisterCommand('debug_faith', (_, amount) => {
            const num = parseInt(amount) || 9999;
            EconomySystem.GetInstance().AddFaith(0 as PlayerID, num);
            print(`[Debug] Added ${num} Faith`);
        }, 'Add faith', 0);

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

        // [BlinkDash] 监听冲刺事件
        CustomGameEventManager.RegisterListener('cmd_c2s_blink_dash', (_, event) => {
            const playerID = (event as any).PlayerID as PlayerID;
            const x = (event as any).x as number;
            const y = (event as any).y as number;
            const z = (event as any).z as number;
            const targetPos = Vector(x, y, z);
            ExecuteDash(playerID, targetPos);
        });

        // [EndGame] 监听结束游戏事件
        CustomGameEventManager.RegisterListener('cmd_end_game', (_, event) => {
            // 设置游戏结束 - 玩家胜利
            GameRules.SetGameWinner(DotaTeam.GOODGUYS);
        });

        // 监听前端验证码请求
        // 验证码同时作为英雄选择：1=剑圣，2=玛西
        CustomGameEventManager.RegisterListener('to_server_verify_code', (_, event) => {
            const playerID = (event as any).PlayerID as PlayerID;
            const code = (event as any).code;
            const player = PlayerResource.GetPlayer(playerID);

            if (player) {
                // 英雄选择映射
                const heroMap: { [key: string]: string } = {
                    '1': 'npc_dota_hero_juggernaut',  // 剑圣
                    '2': 'npc_dota_hero_marci',        // 玛西
                    '669571': 'npc_dota_hero_juggernaut',  // 旧验证码兼容
                };
                
                const selectedHero = heroMap[code];
                
                if (selectedHero) {
                    // 保存玩家选择的英雄
                    this.selectedHeroes[playerID] = selectedHero;
                    
                    // 设置 ForceHero（游戏尚未开始时有效）
                    const game = GameRules.GetGameModeEntity();
                    game.SetCustomGameForceHero(selectedHero);
                    
                    // 检查玩家是否已有英雄
                    const existingHero = player.GetAssignedHero();
                    
                    if (!existingHero) {
                        // 没有英雄，创建新英雄
                        CreateHeroForPlayer(selectedHero, player);
                    } else if (existingHero.GetUnitName() !== selectedHero) {
                        // 英雄不匹配，需要替换
                        this.RestartGame();
                    }
                    
                    CustomGameEventManager.Send_ServerToPlayer(player, 'from_server_verify_result', {
                        success: true,
                        message: '验证成功，正在加载...',
                    });

                    // 验证通过后，如果游戏还没开始，则开始游戏
                    if (!this.isGameStarted) {
                        this.StartGame();
                    }
                } else {
                    CustomGameEventManager.Send_ServerToPlayer(player, 'from_server_verify_result', {
                        success: false,
                        message: '请输入: 1=剑圣, 2=玛西',
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

        // 通知前端开始计时
        CustomGameEventManager.Send_ServerToAllClients('update_game_timer_start', {
            startTime: GameRules.GetGameTime(),
        });

        // 初始化波次管理器
        WaveManager.GetInstance().Initialize();
    }

    // 重置游戏 (软重启)
    private static RestartGame() {
        print('[GameMode] 执行软重启...');
        this.isGameStarted = false;

        // 1. 重置波次管理器（停止计时器并清理怪物）
        WaveManager.GetInstance().Reset();

        // 2. 清理残留怪物
        const enemies = Entities.FindAllByClassname('npc_dota_creature');
        for (const enemy of enemies) {
            if (enemy && !enemy.IsNull() && enemy.IsAlive()) {
                const npc = enemy as CDOTA_BaseNPC;
                npc.ForceKill(false);
                npc.AddNoDraw();
            }
        }

        // 3. 重置玩家英雄状态和位置
        for (let i = 0; i <= 3; i++) {
            const playerID = i as PlayerID; // 显式转换
            const player = PlayerResource.GetPlayer(playerID);
            const hero = PlayerResource.GetSelectedHeroEntity(playerID);
            
            // 检查是否需要替换英雄
            const selectedHero = this.selectedHeroes[playerID];
            
            if (hero && player) {
                const currentHeroName = hero.GetUnitName();
                
                // 如果选择的英雄与当前英雄不同，需要创建新英雄
                if (selectedHero && currentHeroName !== selectedHero) {
                    
                    // 保存位置
                    const spawnPointName = `start_player_${i + 1}`;
                    const spawnPoint = Entities.FindByName(undefined, spawnPointName);
                    
                    // 清除旧英雄的 NetTable 数据
                    const oldIndex = tostring(hero.GetEntityIndex());
                    CustomNetTables.SetTableValue('custom_stats' as any, oldIndex, null as any);
                    
                    // 移除旧英雄
                    hero.RemoveSelf();
                    
                    // 设置 ForceHero
                    const game = GameRules.GetGameModeEntity();
                    game.SetCustomGameForceHero(selectedHero);
                    
                    // 预加载并创建新英雄
                    PrecacheUnitByNameAsync(selectedHero, () => {
                        const newHero = CreateHeroForPlayer(selectedHero, player) as CDOTA_BaseNPC_Hero;
                        if (newHero) {
                            // 设置位置
                            if (spawnPoint) {
                                const origin = spawnPoint.GetAbsOrigin();
                                newHero.SetAbsOrigin(origin);
                                FindClearSpaceForUnit(newHero, origin, true);
                            }
                            
                            // 确保玩家可以控制新英雄
                            newHero.SetControllableByPlayer(playerID, true);
                            
                            // 选中新英雄（让玩家控制）
                            player.SetAssignedHeroEntity(newHero);
                            
                            // 通知客户端刷新英雄数据
                            CustomGameEventManager.Send_ServerToPlayer(player, 'hero_changed', {
                                newHeroIndex: newHero.GetEntityIndex(),
                            });
                        } else {
                            print(`[RestartGame] ERROR: CreateHeroForPlayer returned null!`);
                        }
                    }, playerID);
                } else {
                    // 相同英雄，只需重生
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
            // [Economy] Disable native gold & XP bounty for all units
            unit.SetMaximumGoldBounty(0);
            unit.SetMinimumGoldBounty(0);
            unit.SetDeathXP(0);  // 禁用击杀经验奖励
        }

        if (unit.IsRealHero()) {
            const hero = unit as CDOTA_BaseNPC_Hero;
            const heroName = hero.GetUnitName();
            const playerId = hero.GetPlayerOwnerID();
            
            // 从 JSON 配置读取英雄数据
            // @ts-ignore
            const heroData = json_heroes[heroName];
            
            // 添加配置中的技能（不再硬编码剑圣）
            if (heroData && heroData.Ability1 && playerId >= 0) {
                const abilityName = heroData.Ability1;
                if (abilityName && abilityName !== 'generic_hidden' && abilityName !== '') {
                    hero.AddAbility(abilityName);
                    const ability = hero.FindAbilityByName(abilityName);
                    if (ability) {
                        ability.SetLevel(1);
                        print(`[GameMode] Added ability ${abilityName} to ${heroName}`);
                    }
                }
            }
            
            // 设置基础移速
            if (heroData && heroData.MovementSpeed) {
                const configMoveSpeed = Number(heroData.MovementSpeed);
                unit.SetBaseMoveSpeed(configMoveSpeed);
            }
            
            // [Stats] Initialize Custom Stats
            CustomStats.InitializeHeroStats(hero);

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

                            // [EnemyPanel] 同步单位 KV 数据到 NetTable，供客户端读取
                            const unitName = unit.GetUnitName();
                            const kvData = GetUnitKeyValuesByName(unitName);
                            const statLabel = kvData ? (kvData['StatLabel'] as number || 0) : 0;
                            
                            CustomNetTables.SetTableValue('entity_kv' as any, String(unit.entindex()), {
                                StatLabel: statLabel,
                                Profession: "妖兽",  // 可从 KV 读取
                            });

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

    // ===== XP FILTER =====
    /**
     * XP Filter - 此过滤器仅处理 Dota2 原生的经验系统
     * 我们使用自定义经验系统 (CustomStats.AddCustomExp)，所以这里基本不做干预
     */
    private static XPFilter(event: ModifyExperienceFilterEvent): boolean {
        const heroIndex = event.hero_entindex_const;
        const hero = EntIndexToHScript(heroIndex) as CDOTA_BaseNPC_Hero;

        if (!hero || hero.IsNull() || !hero.IsRealHero()) {
            return true;
        }

        // 获取 display_level 和 rank
        const stats = CustomStats.GetAllStats(hero);
        const displayLevel = stats.display_level ?? hero.GetLevel();
        const rank = stats.rank ?? 0;
        const maxLevel = RankSystem.GetMaxLevelForRank(rank);

        // 使用 display_level 判断是否达到等级上限
        if (displayLevel >= maxLevel) {
            event.experience = 0;
            return false;
        }

        return true;
    }

    // ===== DAMAGE FILTER (护甲穿透/破势) =====
    /**
     * Applies armor penetration to physical damage
     * Formula: Effective Armor = Target Armor - Attacker Armor Pen
     * Dota2 Armor Formula: Damage Reduction = (armor * 0.052) / (1 + armor * 0.052)
     */
    private static DamageFilter(event: DamageFilterEvent): boolean {
        if (event.damage <= 0) return true;
        
        // 只处理物理伤害
        if (event.damagetype_const !== DamageTypes.PHYSICAL) {
            return true;
        }

        const attackerIndex = event.entindex_attacker_const;
        const victimIndex = event.entindex_victim_const;
        
        if (!attackerIndex || !victimIndex) return true;
        
        const attacker = EntIndexToHScript(attackerIndex) as CDOTA_BaseNPC;
        const victim = EntIndexToHScript(victimIndex) as CDOTA_BaseNPC;
        
        if (!attacker || attacker.IsNull() || !victim || victim.IsNull()) {
            return true;
        }
        
        // 仅处理玩家英雄或其召唤物的攻击
        const playerOwner = attacker.GetPlayerOwnerID();
        if (playerOwner < 0) return true;
        
        // 获取攻击者的破势值
        let armorPen = 0;
        
        // 如果是英雄，直接获取属性
        if (attacker.IsRealHero()) {
            armorPen = CustomStats.GetStat(attacker as CDOTA_BaseNPC_Hero, 'armor_pen') || 0;
        } else {
            // 如果是召唤物，从主人获取
            const ownerHero = PlayerResource.GetSelectedHeroEntity(playerOwner);
            if (ownerHero && !ownerHero.IsNull()) {
                armorPen = CustomStats.GetStat(ownerHero, 'armor_pen') || 0;
            }
        }
        
        if (armorPen <= 0) return true;
        
        // 获取目标当前护甲
        const victimArmor = victim.GetPhysicalArmorValue(false);
        
        // 计算有效护甲 (最低为0)
        const effectiveArmor = Math.max(0, victimArmor - armorPen);
        
        // Dota2护甲公式: Damage Reduction = (armor * 0.052) / (1 + armor * 0.052)
        // 我们需要计算伤害乘数来模拟护甲差异
        
        // 原护甲的伤害乘数
        const originalMultiplier = 1 - (victimArmor * 0.052) / (1 + Math.abs(victimArmor) * 0.052);
        // 有效护甲的伤害乘数
        const newMultiplier = 1 - (effectiveArmor * 0.052) / (1 + Math.abs(effectiveArmor) * 0.052);
        
        // 计算需要调整的伤害比例
        if (originalMultiplier > 0) {
            const damageBonus = newMultiplier / originalMultiplier;
            event.damage = event.damage * damageBonus;
            
            // Debug log (可选)
            // print(`[Damage Filter] Armor Pen: ${armorPen}, Armor: ${victimArmor}->${effectiveArmor}, Damage x${damageBonus.toFixed(2)}`);
        }
        
        return true;
    }

    // ===== MERCHANT INTERACTION (Interaction Security) =====
    /**
     * Validates that a player can only interact with their assigned merchant
     * Mapping: PlayerID 0 -> shop_1, PlayerID 1 -> shop_2, etc.
     */
    private static OnMerchantInteract(playerID: PlayerID, entityName: string) {
        if (!PlayerResource.IsValidPlayerID(playerID)) {
            print(`[Merchant] Invalid player ID: ${playerID}`);
            return;
        }

        // Expected shop name for this player
        const expectedShopName = `shop_${playerID + 1}`;

        if (entityName !== expectedShopName) {
            print(`[Merchant] Player ${playerID} tried to access ${entityName}, but is assigned to ${expectedShopName}. Ignoring.`);
            return;
        }

        // Valid interaction - open the merchant panel
        print(`[Merchant] Player ${playerID} accessed ${entityName}. Opening panel.`);
        
        const player = PlayerResource.GetPlayer(playerID);
        if (player) {
            CustomGameEventManager.Send_ServerToPlayer(player, 'open_merchant_panel', {
                shop_id: playerID + 1,
            });
        }
    }
}
