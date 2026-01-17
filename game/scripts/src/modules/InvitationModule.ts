import { TrainingRoomManager } from './TrainingRoomManager';

export class InvitationModule {
    constructor() {
        // Listen for identification code from client
        CustomGameEventManager.RegisterListener('to_server_verify_code', (_, event) => {
            const playerID = (event as any).PlayerID as PlayerID;
            this.OnVerifyCode(playerID, (event as any).code);
        });
        print('InvitationModule initialized');

        // Initialize Training Rooms (Procedural Generation)
        TrainingRoomManager.Init();
    }

    private OnVerifyCode(playerID: PlayerID, code: string) {
        const player = PlayerResource.GetPlayer(playerID);

        if (!player) return;

        // 验证码支持：1=剑圣, 2=玛西, 669571=剑圣（原始验证码）
        let heroName: string | null = null;
        if (code === '1' || code === '669571') {
            heroName = 'npc_dota_hero_juggernaut';
        } else if (code === '2') {
            heroName = 'npc_dota_hero_marci';
        }

        if (heroName) {
            CustomGameEventManager.Send_ServerToPlayer(player, 'from_server_verify_result', {
                success: true,
                message: `验证成功，选择英雄: ${heroName === 'npc_dota_hero_juggernaut' ? '剑圣' : '玛西'}`,
            });

            // Spawn Hero Logic
            let hero = PlayerResource.GetSelectedHeroEntity(playerID);

            if (hero) {
                // If player has a hero, replace it if different
                if (hero.GetUnitName() !== heroName) {
                    const newHero = PlayerResource.ReplaceHeroWith(playerID, heroName, 0, 0);
                    if (newHero) {
                        hero = newHero;
                    } else {
                    }
                } else {
                }
            } else {
                // If no hero exists, create one
                hero = CreateHeroForPlayer(heroName, player);
            }

            if (hero) {
                hero.RespawnHero(false, false);

                // Teleport to user's exclusive Training Room
                const respawnPos = TrainingRoomManager.GetRespawnPosition(playerID);
                hero.SetAbsOrigin(respawnPos);
                FindClearSpaceForUnit(hero, respawnPos, true);

                // Set camera to the hero
                PlayerResource.SetCameraTarget(playerID, hero);
                // Unlock camera after a brief delay
                Timers.CreateTimer(0.1, () => {
                    PlayerResource.SetCameraTarget(playerID, undefined);
                });
            }

            // Stop Background Music and Interface Sounds
            CustomGameEventManager.Send_ServerToPlayer(player, 'stop_custom_sounds', {});

            StopSoundOn('ui_hero_select_music_loop', player);
            StopSoundOn('ui_hero_select_music_intro', player);
            StopSoundOn('ui.main_menu_music', player);
            StopSoundOn('gamestart.01', player);
        } else {
            CustomGameEventManager.Send_ServerToPlayer(player, 'from_server_verify_result', {
                success: false,
                message: '验证码错误，请输入: 1(剑圣) 或 2(玛西)',
            });
        }
    }
}
