import { Player } from '../player/Player';
import { WaveManager } from '../systems/WaveManager';
import { AbilityShopManager } from '../systems/AbilityShopManager';

/**
 * InvitationModule - 验证码和英雄选择模块
 *
 * 监听 'to_server_verify_code' 事件
 * 验证码同时作为英雄选择：1=剑圣，2=玛西
 *
 * 英雄创建委托给 Player.CreateHero()
 */
export class InvitationModule {
    constructor() {
        // Listen for identification code from client
        CustomGameEventManager.RegisterListener('to_server_verify_code', (_, event) => {
            const playerID = (event as any).PlayerID as PlayerID;
            this.OnVerifyCode(playerID, (event as any).code);
        });
    }

    private OnVerifyCode(playerID: PlayerID, code: string) {
        const controller = PlayerResource.GetPlayer(playerID);
        if (!controller) {
            return;
        }

        // 获取或创建 Player 实例
        let player = controller.GetAsset() as Player;
        if (!player) {
            player = new Player(playerID);
            SetPlayerSys(playerID, 'assets', player);
        }

        // 验证码映射
        const heroMap: { [key: string]: string } = {
            '1': 'npc_dota_hero_juggernaut',
            '2': 'npc_dota_hero_marci',
            '669571': 'npc_dota_hero_juggernaut',
        };

        const heroName = heroMap[code];

        if (heroName) {
            // 通过 Player 创建英雄 (统一的英雄创建入口)
            const hero = player.CreateHero(heroName);

            // 如果是同步创建/已存在的英雄，执行初始化
            if (hero) {
                hero.RespawnHero(false, false);

                // 传送到玩家专属出生点
                const spawnPointName = `start_player_${playerID + 1}`;
                const spawnPoint = Entities.FindByName(undefined, spawnPointName);
                if (spawnPoint) {
                    const origin = spawnPoint.GetAbsOrigin();
                    hero.SetAbsOrigin(origin);
                    FindClearSpaceForUnit(hero, origin, true);
                }

                // Set camera to the hero
                PlayerResource.SetCameraTarget(playerID, hero);
                Timers.CreateTimer(0.1, () => {
                    PlayerResource.SetCameraTarget(playerID, undefined);
                });
            }

            CustomGameEventManager.Send_ServerToPlayer(controller, 'from_server_verify_result', {
                success: true,
                message: `验证成功，选择英雄: ${heroName === 'npc_dota_hero_juggernaut' ? '剑圣' : '玛西'}`,
            });

            // 启动波次系统 (第一个验证成功的玩家触发)
            WaveManager.GetInstance().Initialize();

            // Stop Background Music and Interface Sounds
            CustomGameEventManager.Send_ServerToPlayer(controller, 'stop_custom_sounds', {});
            StopSoundOn('ui_hero_select_music_loop', controller);
            StopSoundOn('ui_hero_select_music_intro', controller);
            StopSoundOn('ui.main_menu_music', controller);
            StopSoundOn('gamestart.01', controller);
        } else {
            CustomGameEventManager.Send_ServerToPlayer(controller, 'from_server_verify_result', {
                success: false,
                message: '验证码错误，请输入: 1(剑圣) 或 2(玛西)',
            });
        }
    }
}
