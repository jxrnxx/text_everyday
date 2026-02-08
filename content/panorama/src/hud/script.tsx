import 'panorama-polyfill-x/lib/console';
import 'panorama-polyfill-x/lib/timers';

/** 隐藏一些默认的UI元素 */
import '../utils/hide-default-hud';

import { type FC, useEffect } from 'react';
import { render } from 'react-panorama-x';
import TopHUD from './TopHUD';
import InvitationCode from './InvitationCode';
import TrainingButtons from './TrainingButtons';
import RankUpButton from './RankUpButton';
import MerchantShopPanel from './MerchantShopPanel';
import AbilityShopPanel from './AbilityShopPanel';
import HeroHUD from './HeroHUD';
import EnemyPanel from './EnemyPanel';
// import { KnapsackPanel } from './KnapsackPanel'; // 已废弃
import { DefaultBackpackPanel } from './DefaultBackpackPanel';
import ZoneNotification from './ZoneNotification';
import { closeCurrentPanel, isAnyPanelOpen } from './PanelManager';

const Root: FC = () => {
    return (
        <>
            <TopHUD />
            <InvitationCode />
            <TrainingButtons />
            <RankUpButton />
            <MerchantShopPanel />
            <AbilityShopPanel />
            <HeroHUD />
            <EnemyPanel />
            {/* KnapsackPanel 已废弃，使用 DefaultBackpackPanel 替代 */}
            <DefaultBackpackPanel />
            <ZoneNotification />
        </>
    );
};

render(<Root />, $.GetContextPanel());

// ===== 全局右键关闭面板 =====
// 当有面板打开时，右键点击任意位置关闭当前面板
// 使用 SetPanelEvent 来捕获右键点击
$.GetContextPanel().SetPanelEvent('oncontextmenu', () => {
    if (isAnyPanelOpen()) {
        closeCurrentPanel();
    }
});

// Helper: Reload Scripts with 'R' (Only in Tools Mode)
if (Game.IsInToolsMode()) {
    $.RegisterKeyBind($.GetContextPanel(), 'key_r', () => {
        Game.ServerCmd('dota_reload_addon_script');
    });
}

// ===== Training Room Keybinds (F3/F4) =====
// Disable default UI that conflicts with F3/F4
// 8 = Shop (F4), 17 = Courier (F3)
GameUI.SetDefaultUIEnabled(8, false);   // Disable Shop UI (F4)
GameUI.SetDefaultUIEnabled(17, false);  // Disable Courier UI (F3)

// Get local player ID
const localPlayerId = Game.GetLocalPlayerID();

// Build command strings with player ID
const cmdEnter = `cmd_train_enter ${localPlayerId}`;
const cmdExit = `cmd_train_exit ${localPlayerId}`;

// Bind F3 and F4 keys
Game.CreateCustomKeyBind('F3', cmdEnter);
Game.CreateCustomKeyBind('F4', cmdExit);

// ===== Dash Skill Keybind (D Key) =====
// 使用和 C 键（角色面板）相同的模式
const cmdDashName = 'cmd_dash_' + Math.floor(Math.random() * 10000);

// 注册冲刺命令
Game.AddCommand(cmdDashName, () => {
    // 获取鼠标屏幕坐标
    const cursorPos = GameUI.GetCursorPosition();

    // 转换为世界坐标
    const worldPos = GameUI.GetScreenWorldPosition(cursorPos);

    if (worldPos) {
        // 发送冲刺事件到服务端，包含鼠标世界坐标
        GameEvents.SendCustomGameEventToServer('cmd_c2s_blink_dash', {
            x: worldPos[0],
            y: worldPos[1],
            z: worldPos[2],
        });
    }
}, '', 0);

// 绑定 D 键到冲刺命令
Game.CreateCustomKeyBind('D', cmdDashName);

// ===== Backpack Toggle Keybind (Tab Key) =====
const cmdBackpackName = 'cmd_backpack_' + Math.floor(Math.random() * 10000);

Game.AddCommand(cmdBackpackName, () => {
    if ((GameUI as any).ToggleBackpack) {
        (GameUI as any).ToggleBackpack();
    }
}, '', 0);

Game.CreateCustomKeyBind('TAB', cmdBackpackName);
