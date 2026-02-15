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

// ===== Public Skill Keybinds (F/G Keys) =====
// 公共技能名列表
const PUBLIC_ABILITY_NAMES = [
    'ability_public_martial_cleave',
    'ability_public_plague_cloud',
    'ability_public_golden_bell',
    'ability_public_flame_storm',
    // 未来添加更多
];

// 扫描英雄所有技能，找到第 slotIdx 个公共技能的 entityIndex
const findPublicAbilityEntity = (slotIdx: number): number => {
    const localHero = Players.GetPlayerHeroEntityIndex(Players.GetLocalPlayer());
    if (localHero === -1) return -1;

    let found = 0;
    // @ts-ignore
    const abilityCount = Entities.GetAbilityCount(localHero) || 24;
    for (let i = 0; i < Math.min(abilityCount, 24); i++) {
        // @ts-ignore
        const ability = Entities.GetAbility(localHero, i);
        if (!ability || ability === -1) continue;
        // @ts-ignore
        const name = Abilities.GetAbilityName(ability);
        // @ts-ignore
        const level = Abilities.GetLevel(ability);
        if (PUBLIC_ABILITY_NAMES.indexOf(name) !== -1 && level > 0) {
            if (found === slotIdx) return ability;
            found++;
        }
    }
    return -1;
};

// F 键 → 第一个公共技能
const cmdSkillF = 'cmd_public_skill_f_' + Math.floor(Math.random() * 10000);
Game.AddCommand(cmdSkillF, () => {
    const localHero = Players.GetPlayerHeroEntityIndex(Players.GetLocalPlayer());
    const ability = findPublicAbilityEntity(0);
    if (ability !== -1 && localHero !== -1) {
        // @ts-ignore
        Abilities.ExecuteAbility(ability, localHero, false);
    }
}, '', 0);
Game.CreateCustomKeyBind('F', cmdSkillF);

// G 键 → 第二个公共技能
const cmdSkillG = 'cmd_public_skill_g_' + Math.floor(Math.random() * 10000);
Game.AddCommand(cmdSkillG, () => {
    const localHero = Players.GetPlayerHeroEntityIndex(Players.GetLocalPlayer());
    const ability = findPublicAbilityEntity(1);
    if (ability !== -1 && localHero !== -1) {
        // @ts-ignore
        Abilities.ExecuteAbility(ability, localHero, false);
    }
}, '', 0);
Game.CreateCustomKeyBind('G', cmdSkillG);

// ===== 滚轮调整镜头Z轴高度 =====
// 用于在高海拔地形区域（如3000px高度差）查看地图
let cameraHeightOffset = 0; // 当前镜头高度偏移
const CAMERA_HEIGHT_STEP = 150; // 每次滚轮滚动的高度变化量
const CAMERA_HEIGHT_MIN = -500; // 最低偏移（向下看）
const CAMERA_HEIGHT_MAX = 4000; // 最高偏移（向上看，足以看清3000px高度的区域）

GameUI.SetMouseCallback((event, value) => {
    // 只处理滚轮事件
    if (event === 'wheeled') {
        const direction = value as MouseScrollDirection;
        // 滚轮向上 (1) = 镜头升高, 滚轮向下 (-1) = 镜头降低
        cameraHeightOffset += direction * CAMERA_HEIGHT_STEP;
        // 限制范围
        cameraHeightOffset = Math.max(CAMERA_HEIGHT_MIN, Math.min(CAMERA_HEIGHT_MAX, cameraHeightOffset));
        GameUI.SetCameraLookAtPositionHeightOffset(cameraHeightOffset);
        return true; // 消费事件，不传递给引擎
    }
    return false; // 其它鼠标事件正常传递
});
