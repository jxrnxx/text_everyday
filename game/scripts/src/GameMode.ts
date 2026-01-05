
// 游戏模式类
export class GameMode {
    private static isGameStarted = false;
    private static currentWaveTimer: string | null = null; // 存储计时器ID以便取消

    public static Activate() {
        GameRules.SetCustomGameTeamMaxPlayers(DotaTeam.GOODGUYS, 4);
        GameRules.SetCustomGameTeamMaxPlayers(DotaTeam.BADGUYS, 0);

        GameRules.SetPreGameTime(0); 
        GameRules.SetHeroSelectionTime(0); 
        GameRules.SetStrategyTime(0); 
        GameRules.GetGameModeEntity().SetCustomGameForceHero("npc_dota_hero_juggernaut");
        GameRules.GetGameModeEntity().SetFogOfWarDisabled(true);

        ListenToGameEvent('npc_spawned', (event) => this.OnNpcSpawned(event), undefined);
        
        // 监听聊天指令: 输入 r 或 R 重新加载脚本 (无需重启游戏)
        ListenToGameEvent("player_chat", (event) => {
            if (event.text === "r" || event.text === "R") {
                print("[GameMode] 收到指令: 重新加载脚本 (script_reload)");
                SendToConsole("script_reload");
            }
        }, undefined);

        // 监听前端验证码请求
        CustomGameEventManager.RegisterListener("to_server_verify_code", (_, event) => {
            const playerID = (event as any).PlayerID as PlayerID;
            const code = (event as any).code;
            const player = PlayerResource.GetPlayer(playerID);

            if (player) {
                if (code === "1" || code === "669571") { 
                    print(`[GameMode] 玩家 ${playerID} 验证通过`);
                    CustomGameEventManager.Send_ServerToPlayer(player, "from_server_verify_result", {
                        success: true,
                        message: "验证成功"
                    });
                    
                    // 验证通过后，如果游戏还没开始，则开始游戏
                    if (!this.isGameStarted) {
                        this.StartGame();
                    }

                } else {
                    CustomGameEventManager.Send_ServerToPlayer(player, "from_server_verify_result", {
                        success: false,
                        message: "验证码错误，请输入: 1"
                    });
                }
            }
        });

        print("[GameMode] 游戏模式已激活: 等待验证...");

        // 如果是重新加载脚本 (游戏已经在进行中)，则自动执行一次软重启以应用新逻辑
        if (GameRules.State_Get() >= 4) { // 4 = DOTA_GAMERULES_STATE_PRE_GAME
            print("[GameMode] 检测到脚本重载，自动执行 RestartGame...");
            this.RestartGame(); 
        }
    }

    // 开始游戏逻辑
    private static StartGame() {
        if (this.isGameStarted) return;
        this.isGameStarted = true;
        print("[GameMode] 游戏正式开始！启动刷怪和计时...");

        // 通知前端开始计时 (修正时间显示)
        CustomGameEventManager.Send_ServerToAllClients("update_game_timer_start", { 
            startTime: GameRules.GetGameTime() 
        });

        // 延迟3秒后开始第一波 (给玩家一点准备时间)
        this.currentWaveTimer = Timers.CreateTimer(3, () => {
            this.StartWave(1);
            return undefined;
        });
    }

    // 重置游戏 (软重启)
    private static RestartGame() {
        print("[GameMode] 执行软重启...");
        this.isGameStarted = false;

        // 1. 停止当前刷怪计时器
        if (this.currentWaveTimer) {
            Timers.RemoveTimer(this.currentWaveTimer);
            this.currentWaveTimer = null;
        }

        // 2. 清理所有怪物
        const enemies = Entities.FindAllByClassname("npc_dota_creature");
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
        CustomGameEventManager.Send_ServerToAllClients("reset_game_timer", {});

        // 5. 重新开始游戏 (可以直接开始，或者让玩家准备一下)
        // 这里我们选择立即重新开始，方便测试
        this.StartGame();
    }

    // NPC出生事件处理
    private static OnNpcSpawned(event: NpcSpawnedEvent) {
        // ... (保持原有逻辑不变，只展示部分)
        const unit = EntIndexToHScript(event.entindex) as CDOTA_BaseNPC;
        if (!unit) return;
        if (unit.IsRealHero()) {
            const playerId = unit.GetPlayerOwnerID();
            if (playerId >= 0 && playerId <= 3) {
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

        print(`[GameMode] 第 ${waveNumber} 波开始！(持续60秒)`);

        // ... (目标获取逻辑)
        let targetEntity = Entities.FindByName(undefined, "dota_goodguys_fort");
        let targetPos: Vector = Vector(0, 0, 0);

        if (targetEntity) {
            targetPos = targetEntity.GetAbsOrigin();
            print(`[GameMode DEBUG] 找到基地目标: dota_goodguys_fort, 位置: ${targetPos.x}, ${targetPos.y}, ${targetPos.z}`);
        } else {
            print(`[GameMode DEBUG] 警告: 未找到 dota_goodguys_fort，尝试查找玩家英雄...`);
            const playerHero = PlayerResource.GetSelectedHeroEntity(0);
            if (playerHero) {
                targetEntity = playerHero;
                targetPos = playerHero.GetAbsOrigin();
                print(`[GameMode DEBUG] 找到英雄目标: ${playerHero.GetUnitName()}, 位置: ${targetPos.x}, ${targetPos.y}, ${targetPos.z}`);
            } else {
                 print(`[GameMode DEBUG] 严重警告: 既找不到基地也找不到英雄，怪物将攻击 (0,0,0)`);
            }
        }

        let duration = 60; 
        let interval = 0.5;
        let ticks = duration / interval;
        let currentTick = 0;

        // 启动持续刷怪计时器
        Timers.CreateTimer(0, () => {
            if (!this.isGameStarted) return undefined; // 安全检查：游戏重置则停止
            if (currentTick >= ticks) {
                print(`[GameMode] 第 ${waveNumber} 波结束`);
                return undefined;
            }

            // ... (刷怪循环逻辑)
            for (let i = 1; i <= 3; i++) {
                const spawnerName = `spawner_${i}`;
                const spawner = Entities.FindByName(undefined, spawnerName);
                if (spawner) {
                    const spawnerPos = spawner.GetAbsOrigin();
                    CreateUnitByNameAsync("npc_enemy_zombie_lvl1", spawnerPos, true, undefined, undefined, DotaTeam.BADGUYS, (unit) => {
                        if (unit) {
                            unit.SetAcquisitionRange(800); // 加大仇恨范围

                            // 强制赋予 AI 思考能力，防止发呆
                            unit.SetContextThink("ZombieThink", () => {
                                if (unit && !unit.IsNull() && unit.IsAlive()) {
                                    // 检查寻路状态
                                    const canFindPath = GridNav.CanFindPath(unit.GetAbsOrigin(), targetPos);
                                    
                                    // 如果没有在攻击，强制往目标走
                                    if (unit.IsIdle() || !unit.IsAttacking()) {
                                        // 如果寻路失败，尝试找一下附近的空地 (防卡住)
                                        if (!canFindPath) {
                                            print(`[DEBUG] 僵尸无法寻路到目标! 尝试原地 FindClearSpace`);
                                            FindClearSpaceForUnit(unit, unit.GetAbsOrigin(), true);
                                        }

                                         ExecuteOrderFromTable({
                                            UnitIndex: unit.entindex(),
                                            OrderType: UnitOrder.ATTACK_MOVE,
                                            Position: targetPos,
                                            Queue: false,
                                        });

                                        // 偶尔打印一下状态 (每3秒打印一次，避免刷屏)
                                        if (GameRules.GetGameTime() % 3.0 < 0.2) {
                                            print(`[DEBUG] 僵尸正在思考... 目标位置: ${targetPos}, 寻路检查: ${canFindPath ? "通过" : "失败"}`);
                                        }
                                    }
                                    return 1.0; // 每秒检查一次
                                }
                                return undefined;
                            }, 0.1); 
                        }
                    });
                }
            }

            currentTick++;
            return interval;
        });
    }
}
