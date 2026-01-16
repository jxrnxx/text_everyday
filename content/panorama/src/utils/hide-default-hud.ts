let hud: Panel | null = null;

function HideHudElements(name: string) {
    if (hud == null) {
        hud = $.GetContextPanel();
        while (hud?.GetParent() != null) {
            hud = hud?.GetParent()!;
        }
    }
    const panel = hud.FindChildTraverse(name);
    if (panel) {
        panel.style.visibility = `collapse`;
    }
}

function ShowHudElement(name: string) {
    if (hud == null) {
        hud = $.GetContextPanel();
        while (hud?.GetParent() != null) {
            hud = hud?.GetParent()!;
        }
    }
    const panel = hud.FindChildTraverse(name);
    if (panel) {
        panel.style.visibility = `visible`;
        panel.style.opacity = '1';
    }
}

function HideDefaultHud() {
    // 隐藏小地图
    GameUI.SetDefaultUIEnabled(DotaDefaultUIElement_t.DOTA_DEFAULT_UI_ACTION_MINIMAP, false);
    // 隐藏商店
    GameUI.SetDefaultUIEnabled(DotaDefaultUIElement_t.DOTA_DEFAULT_UI_INVENTORY_SHOP, false);
    // 隐藏顶部栏
    GameUI.SetDefaultUIEnabled(DotaDefaultUIElement_t.DOTA_DEFAULT_UI_TOP_BAR, false);
    // 隐藏单位信息面板（商人点击不显示原生UI）
    // 14 = DOTA_DEFAULT_UI_HERO_SELECTION_TEAMS / Unit selection panel
    GameUI.SetDefaultUIEnabled(14 as DotaDefaultUIElement_t, false);
    // 隐藏整个底部动作面板 (英雄技能栏 + 单位信息)
    GameUI.SetDefaultUIEnabled(DotaDefaultUIElement_t.DOTA_DEFAULT_UI_ACTION_PANEL, false);

    // 左上角的击杀、死亡、助攻补刀等
    HideHudElements('quickstats');
    // 隐藏左上角得分面板按钮
    HideHudElements('ToggleScoreboardButton');
    // 小地图的塔防和扫描面板
    HideHudElements('GlyphScanContainer');
    // 隐藏TP格子
    HideHudElements('inventory_tpscroll_container');
    // 隐藏中立物品格子
    HideHudElements('inventory_neutral_slot_container');
    // 隐藏击杀者信息面板
    HideHudElements('KillCam');
    // 隐藏储藏处
    HideHudElements('stash');
    // 隐藏暂停信息
    HideHudElements('PausedInfo');
    // 隐藏选中单位信息面板 (商人等)
    HideHudElements('selected_container');
    HideHudElements('selected');
    HideHudElements('SelectedEntityHealth');
    // 隐藏魔方计时器（Tormentor Timer）
    HideHudElements('TormentorTimerContainer');
    HideHudElements('TormentorTimer');
    // 隐藏肉山计时器
    HideHudElements('RoshanTimerContainer');
}

HideDefaultHud();

// 延迟再隐藏一次（确保面板已加载）
$.Schedule(1.0, () => {
    HideHudElements('selected_container');
    HideHudElements('selected');
    // 隐藏底部动作面板的各个部分 - 但保留聊天框
    // HideHudElements('HUDElements'); // 不再隐藏，这会隐藏聊天框
    // HideHudElements('lower_hud'); // 不再隐藏，这会隐藏聊天框
    HideHudElements('center_block');
    HideHudElements('center_with_stats');
    HideHudElements('unitPortrait');
    HideHudElements('PortraitGroup');
    HideHudElements('inventory_items');
    HideHudElements('AbilitiesAndStatBranch');
    HideHudElements('HeroInventory');
    
    // 确保聊天框可见
    ShowHudElement('HudChat');
    ShowHudElement('ChatInputLine');
});

// 每秒持续检查并隐藏（某些面板会动态加载）
$.Schedule(0.5, function hideLoop() {
    HideHudElements('center_block');
    HideHudElements('center_with_stats');
    HideHudElements('PortraitGroup');
    // 隐藏设置/快捷键按钮（左上角的加号）
    HideHudElements('SettingsButton');
    HideHudElements('GameSettingsButton');
    HideHudElements('MenuButtons');
    // 确保聊天框始终可见
    ShowHudElement('HudChat');
    ShowHudElement('ChatInputLine');
    $.Schedule(2.0, hideLoop);
});
