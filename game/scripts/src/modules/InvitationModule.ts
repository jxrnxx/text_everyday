
import { TrainingRoomManager } from "./TrainingRoomManager";

export class InvitationModule {
    constructor() {
        // Listen for identification code from client
        CustomGameEventManager.RegisterListener("to_server_verify_code", (_, event) => {
            const playerID = (event as any).PlayerID as PlayerID; 
            this.OnVerifyCode(playerID, (event as any).code);
        });
        print("InvitationModule initialized");

        // Initialize Training Rooms (Procedural Generation)
        TrainingRoomManager.Init();
    }

    private OnVerifyCode(playerID: PlayerID, code: string) {
        const correctCode = "669571";
        const player = PlayerResource.GetPlayer(playerID);
        
        if (!player) return;

        if (code === correctCode) {
            CustomGameEventManager.Send_ServerToPlayer(player, "from_server_verify_result", {
                success: true,
                message: "Verification Successful"
            });
            print(`Player ${playerID} verified successfully.`);
            
            // Spawn Hero Logic: Force Pick Juggernaut
            const heroName = "npc_dota_hero_juggernaut"; 
            let hero = PlayerResource.GetSelectedHeroEntity(playerID);

            if (hero) {
                // If player has a hero (e.g. Wisp or previous one), replace it
                print(`Replacing existing hero for player ${playerID}`);
                // Verify if it is already Juggernaut
                if (hero.GetUnitName() !== heroName) {
                    const newHero = PlayerResource.ReplaceHeroWith(playerID, heroName, 0, 0);
                    if (newHero) {
                        hero = newHero; 
                    }
                }
            } else {
                // If no hero exists, create one
                print(`Creating new hero for player ${playerID}`);
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
            CustomGameEventManager.Send_ServerToPlayer(player, "stop_custom_sounds", {});
            
            StopSoundOn("ui_hero_select_music_loop", player);
            StopSoundOn("ui_hero_select_music_intro", player);
            StopSoundOn("ui.main_menu_music", player);
            StopSoundOn("gamestart.01", player);

        } else {
            CustomGameEventManager.Send_ServerToPlayer(player, "from_server_verify_result", {
                success: false,
                message: "Invalid Invitation Code"
            });
            print(`Player ${playerID} verification failed with code: ${code}`);
        }
    }
}
