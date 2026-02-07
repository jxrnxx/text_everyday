import { reloadable } from '../utils/tstl-utils';
import type { EasingFunctionName } from '../utils/tween';
import { tween } from '../utils/tween';
import { ArtifactSystem } from '../systems/ArtifactSystem';

type DebugCallbackFunction = (hero: CDOTA_BaseNPC_Hero, ...args: string[]) => void;

/** 所有的测试指令的回调 */
const DebugCallbacks: Record<string, { desc: string; func: DebugCallbackFunction }> = {
    ['-help']: {
        desc: '显示所有的测试指令',
        func: () => {
            for (const [cmd, { desc }] of Object.entries(DebugCallbacks)) {
            }
        },
    },
    ['-s']: {
        desc: '重载脚本',
        func: () => {
            SendToConsole('script_reload');
        },
    },
    ['-r']: {
        desc: '重启游戏',
        func: () => {
            SendToConsole('restart'); // 重启游戏
        },
    },
    ['get_key_v3']: {
        desc: '获取v3版本的key',
        func: (hero, ...args: string[]) => {
            const version = args[0];
            const key = GetDedicatedServerKeyV3(version);
            Say(hero, `${version}: ${key}`, true);
        },
    },
    ['get_key_v2']: {
        desc: '获取v2版本的key， get_key_v2 version',
        func: (hero, ...args: string[]) => {
            const version = args[0];
            const key = GetDedicatedServerKeyV2(version);
            Say(hero, `${version}: ${key}`, true);
        },
    },
    ['-tween']: {
        desc: '测试Tween',
        func: (hero, ...args: string[]) => {
            FindClearSpaceForUnit(hero, hero.GetAbsOrigin(), true);
            const source = { scale: 1 };
            const target = { scale: 3 };
            const duration = 0.3;
            const funcName = args[0];
            const myTween = tween(duration, source, target, funcName as EasingFunctionName);
            let now = GameRules.GetGameTime();
            Timers.CreateTimer(() => {
                const dt = GameRules.GetGameTime() - now;
                now = GameRules.GetGameTime();
                const finished = myTween.update(dt);
                if (finished) {
                    return null;
                } else {
                    print(source.scale);
                    hero.SetModelScale(source.scale);
                    return 0.03;
                }
            });
        },
    },
    ['-zhuangbei']: {
        desc: '装备调试: -zhuangbei up (升级所有神器) / reset (重置为T0)',
        func: (hero, ...args: string[]) => {
            const playerId = hero.GetPlayerID();
            const subCmd = args[0]?.toLowerCase();

            if (subCmd === 'up') {
                const count = ArtifactSystem.GetInstance().UpgradeAllArtifacts(playerId);
                if (count > 0) {
                    Say(hero, `神器全部升级! (${count}个槽位)`, false);
                } else {
                    Say(hero, '所有神器已达最高阶!', false);
                }
            } else if (subCmd === 'reset') {
                // 重新初始化为 T0
                (ArtifactSystem.GetInstance() as any).playerArtifacts.delete(playerId);
                ArtifactSystem.GetInstance().InitPlayerArtifacts(playerId);
                Say(hero, '神器已重置为蒙尘状态 (T0)', false);
            } else {
                Say(hero, '用法: -zhuangbei up / reset', false);
            }
        },
    },
};

@reloadable
export class Debug {
    DebugEnabled = false;
    private _chatListener: EventListenerID;

    // 在线测试白名单
    OnlineDebugWhiteList = [
        86815341, // Xavier
    ];

    constructor() {
        // 工具模式下开启调试
        if (IsInToolsMode()) {
            this._toggleDebugMode(true);
        }
        this._chatListener = ListenToGameEvent(`player_chat`, keys => this.OnPlayerChat(keys), this);
    }

    private _toggleDebugMode(on?: boolean) {
        if (on === undefined) {
            this.DebugEnabled = !this.DebugEnabled;
        } else {
            this.DebugEnabled = on;
        }
        if (this.DebugEnabled) {
        } else {
        }
    }

    OnPlayerChat(keys: GameEventProvidedProperties & PlayerChatEvent): void {
        const strs = keys.text.split(' ');
        const cmd = strs[0];
        const args = strs.slice(1);
        const steamid = PlayerResource.GetSteamAccountID(keys.playerid);

        if (cmd === '-debug') {
            if (this.OnlineDebugWhiteList.includes(steamid)) {
                this._toggleDebugMode();
            }
        }

        // 只在允许调试的时候才执行以下指令
        // commands that only work in debug mode below:
        if (!this.DebugEnabled) return;

        const hero = HeroList.GetHero(0);

        if (DebugCallbacks[cmd]) {
            DebugCallbacks[cmd].func(hero, ...args);
        }
    }
}
