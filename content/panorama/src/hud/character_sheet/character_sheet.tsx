import { openPanel, markPanelClosed, registerPanel, closeCurrentPanel } from '../PanelManager';

// Rank Data Structure
const RANK_DATA = {
    1: { title: "凡胎", desc: "肉眼凡胎，受困于世。" },
    2: { title: "觉醒", desc: "窥见真实，打破枷锁。" },
    3: { title: "宗师", desc: "技近乎道，登峰造极。" },
    4: { title: "半神", desc: "神性初显，超脱凡俗。" },
    5: { title: "神话", desc: "传颂之名，永恒不朽。" },
    6: { title: "禁忌", desc: "不可直视，不可名状。" }
};

const DEFAULT_RANK = { title: "凡胎", desc: "肉眼凡胎，受困于世。" };

const JOB_NAME_MAP: { [key: string]: string } = {
    "bing_shen_dao": "兵神道",
    // Add other mappings here as needed
};

let isOpen = false;

// 内部关闭函数
function CloseCharSheet() {
    isOpen = false;
    const panel = $('#CharSheetContainer');
    if (panel) {
        panel.SetHasClass('Hidden', true);
    }
    Game.EmitSound('ui_menu_activate_close');
    markPanelClosed('character_sheet');
}

function ToggleCharSheet() {
    isOpen = !isOpen;
    const panel = $('#CharSheetContainer');
    if (panel) {
        panel.SetHasClass('Hidden', !isOpen);
    }

    if (isOpen) {
        openPanel('character_sheet'); // 这会自动关闭其他面板
        UpdateAllStats();
        GameEvents.SendCustomGameEventToServer("request_custom_stats", {} as any);
        Game.EmitSound('ui_menu_activate_open');
    } else {
        markPanelClosed('character_sheet');
        Game.EmitSound('ui_menu_activate_close');
    }
}

// Expose to Global
($.GetContextPanel() as any).ToggleCharSheet = ToggleCharSheet;
(Game.GetLocalPlayerInfo() as any).ToggleCharSheet = ToggleCharSheet; // Hacker attempt to expose wider

function UpdateAllStats() {
    const localHero = Players.GetPlayerHeroEntityIndex(Players.GetLocalPlayer());
    if (localHero === -1) return;

    // 1. Custom Stats from NetTable
    const netTableKey = String(localHero);
    const netTableData = CustomNetTables.GetTableValue('custom_stats' as any, netTableKey);
    const level = Entities.GetLevel(localHero);

    if (netTableData) {
        const d = netTableData as any;
        
        // 基础信息
        const rankLevel = d.rank || 1;
        // @ts-ignore
        const rankInfo = RANK_DATA[rankLevel] || DEFAULT_RANK;
        ($('#Val_Rank') as LabelPanel).text = rankInfo.title;
        
        let professionKey = d.profession;
        let professionName = "-";
        if (professionKey && professionKey !== "undefined") {
            professionName = JOB_NAME_MAP[professionKey] || professionKey;
        }
        ($('#Val_Profession') as LabelPanel).text = professionName;
        ($('#Val_Level') as LabelPanel).text = level.toString();
        
        // ===== 15个属性字段 =====
        
        // 根骨 (Constitution)
        const conBase = d.constitution_base || 0;
        const conGain = d.constitution_gain || 0;
        const conBonus = d.constitution_bonus || 0;
        const conPanel = Math.floor((conBase + (level - 1) * conGain) * (1 + conBonus));
        ($('#Val_Con_Base') as LabelPanel).text = conBase.toString();
        ($('#Val_Con_Gain') as LabelPanel).text = conGain.toString();
        ($('#Val_Con_Bonus') as LabelPanel).text = conBonus.toString();
        ($('#Val_Con_Panel') as LabelPanel).text = conPanel.toString();
        
        // 武道 (Martial)
        const marBase = d.martial_base || 0;
        const marGain = d.martial_gain || 0;
        const marBonus = d.martial_bonus || 0;
        const marPanel = Math.floor((marBase + (level - 1) * marGain) * (1 + marBonus));
        ($('#Val_Mar_Base') as LabelPanel).text = marBase.toString();
        ($('#Val_Mar_Gain') as LabelPanel).text = marGain.toString();
        ($('#Val_Mar_Bonus') as LabelPanel).text = marBonus.toString();
        ($('#Val_Mar_Panel') as LabelPanel).text = marPanel.toString();
        
        // 神念 (Divinity)
        const divBase = d.divinity_base || 0;
        const divGain = d.divinity_gain || 0;
        const divBonus = d.divinity_bonus || 0;
        const divPanel = Math.floor((divBase + (level - 1) * divGain) * (1 + divBonus));
        ($('#Val_Div_Base') as LabelPanel).text = divBase.toString();
        ($('#Val_Div_Gain') as LabelPanel).text = divGain.toString();
        ($('#Val_Div_Bonus') as LabelPanel).text = divBonus.toString();
        ($('#Val_Div_Panel') as LabelPanel).text = divPanel.toString();
        
        // 身法 (Agility)
        const agiBase = d.agility_base || 0;
        const agiGain = d.agility_gain || 0;
        const agiBonus = d.agility_bonus || 0;
        const agiPanel = Math.floor((agiBase + (level - 1) * agiGain) * (1 + agiBonus));
        ($('#Val_Agi_Base') as LabelPanel).text = agiBase.toString();
        ($('#Val_Agi_Gain') as LabelPanel).text = agiGain.toString();
        ($('#Val_Agi_Bonus') as LabelPanel).text = agiBonus.toString();
        ($('#Val_Agi_Panel') as LabelPanel).text = agiPanel.toString();
        
        // 攻击力 (Damage)
        const dmgBase = d.damage_base || 0;
        const dmgGain = d.damage_gain || 0;
        const dmgBonus = d.damage_bonus || 0;
        const dmgPanel = Math.floor((dmgBase + (level - 1) * dmgGain) * (1 + dmgBonus));
        ($('#Val_Dmg_Base') as LabelPanel).text = dmgBase.toString();
        ($('#Val_Dmg_Gain') as LabelPanel).text = dmgGain.toString();
        ($('#Val_Dmg_Bonus') as LabelPanel).text = dmgBonus.toString();
        
        // 主属性计算
        const mainStat = d.main_stat || 'Martial';
        const mainPanel = mainStat === 'Martial' ? marPanel : divPanel;
        const totalDmg = dmgPanel + mainPanel * 2 + (d.purchased_base_damage || 0);
        ($('#Val_Dmg_Panel') as LabelPanel).text = totalDmg.toString();
        ($('#Val_Attack_Display') as LabelPanel).text = totalDmg.toString();  // 实战属性中的攻击力也用计算值
        
        // Crit
        const critChance = d.crit_chance || 0;
        const critDmg = d.crit_damage || 150;
        ($('#Val_CritChance') as LabelPanel).text = `${critChance}%`;
        ($('#Val_CritDamage') as LabelPanel).text = `${critDmg}%`;
        
        // 商店购买
        const shopAtkSpeed = d.purchased_attack_speed || 0;
        const shopManaRegen = d.purchased_mana_regen || 0;
        const shopArmor = d.purchased_armor || 0;
        const shopMoveSpeed = d.purchased_move_speed || 0;
        const shopDamage = d.purchased_base_damage || 0;
        
        ($('#Val_Shop_AtkSpeed') as LabelPanel).text = shopAtkSpeed.toString();
        ($('#Val_Shop_ManaRegen') as LabelPanel).text = shopManaRegen.toString();
        ($('#Val_Shop_Armor') as LabelPanel).text = shopArmor.toString();
        ($('#Val_Shop_MoveSpeed') as LabelPanel).text = shopMoveSpeed.toString();
        ($('#Val_Shop_Damage') as LabelPanel).text = shopDamage.toString();
        
        // 计算攻速面板值
        const panelAtkSpeed = 100 + agiPanel + shopAtkSpeed;
        ($('#Val_AtkSpeed') as LabelPanel).text = panelAtkSpeed.toString();
        
        // 公式说明 - 使用中文显示主属性
        const mainStatCN = mainStat === 'Martial' ? '武道' : '神念';
        ($('#Debug_Con') as LabelPanel).text = `根骨: (${conBase}+(${level}-1)×${conGain})×(1+${conBonus}) = ${conPanel}`;
        ($('#Debug_Mar') as LabelPanel).text = `武道: (${marBase}+(${level}-1)×${marGain})×(1+${marBonus}) = ${marPanel}`;
        ($('#Debug_Div') as LabelPanel).text = `神念: (${divBase}+(${level}-1)×${divGain})×(1+${divBonus}) = ${divPanel}`;
        ($('#Debug_Agi') as LabelPanel).text = `身法: (${agiBase}+(${level}-1)×${agiGain})×(1+${agiBonus}) = ${agiPanel}`;
        ($('#Debug_Dmg') as LabelPanel).text = `攻击: ${dmgPanel} + 主属(${mainStatCN}${mainPanel})×2 + 商店${shopDamage} = ${totalDmg}`;
        ($('#Debug_AtkSpeed') as LabelPanel).text = `攻速: 100 + 身法${agiPanel} + 商店${shopAtkSpeed} = ${panelAtkSpeed}`;
        ($('#Debug_HP') as LabelPanel).text = `生命: 根骨面板(${conPanel}) × 50 = ${conPanel * 50}`;
        
        // 移速公式
        const agiMoveBonus = Math.floor(agiPanel * 0.4);
        const baseMoveSpeed = 300;  // 基础移速从配置读取
        const panelMoveSpeed = baseMoveSpeed + agiMoveBonus + shopMoveSpeed;
        ($('#Debug_MoveSpeed') as LabelPanel).text = `移速: ${baseMoveSpeed} + 身法${agiPanel}×0.4=${agiMoveBonus} + 商店${shopMoveSpeed} = ${panelMoveSpeed}`;
    }

    // 2. Economy from NetTable
    const economyData = CustomNetTables.GetTableValue('economy' as any, `player_${Players.GetLocalPlayer()}`);
    if (economyData) {
        ($('#Val_SpiritCoin') as LabelPanel).text = (economyData as any).spirit_coin || '0';
        ($('#Val_Faith') as LabelPanel).text = (economyData as any).faith || '0';
    }

    // 3. Base Stats (API) - 只获取必要的 API 数据
    
    // Armor - 从 API 获取（因为有游戏内其他来源）
    const armor = Entities.GetPhysicalArmorValue(localHero);
    ($('#Val_Armor') as LabelPanel).text = armor.toFixed(1);

    // Health / Mana - 从 API 获取当前值
    const hp = Entities.GetHealth(localHero);
    const maxHp = Entities.GetMaxHealth(localHero);
    const mana = Entities.GetMana(localHero);
    const maxMana = Entities.GetMaxMana(localHero);

    ($('#Val_Health') as LabelPanel).text = `${hp} / ${maxHp}`;
    ($('#Val_Mana') as LabelPanel).text = `${mana} / ${maxMana}`;
    
    // 注意：攻击力和攻速已经在上面 netTableData 块中用公式计算并设置了
    // Val_Dmg_Panel = 计算的攻击力
    // Val_AtkSpeed = 计算的攻速 (100 + 身法 + 商店)

    // Move Speed - 从 API 获取
    const moveSpeed = Entities.GetIdealSpeed(localHero);
    ($('#Val_MoveSpeed') as LabelPanel).text = moveSpeed.toString();

    // Kills (PlayerResource)
    const kills = Players.GetKills(Players.GetLocalPlayer());
    ($('#Val_Kills') as LabelPanel).text = kills.toString();
}

// Auto Update Loop when Open
function AutoUpdate() {
    if (isOpen) {
        UpdateAllStats();
    }
    $.Schedule(0.5, AutoUpdate);
}

// -------------------------------------------------------------------------
// Init
// -------------------------------------------------------------------------
// -------------------------------------------------------------------------
// Init
// -------------------------------------------------------------------------
function Init() {
    try {
        // 注册到 PanelManager
        registerPanel('character_sheet', CloseCharSheet);
        
    // Register Command
        const cmdName = "ToggleCharSheet_" + Math.floor(Math.random() * 10000);
        Game.AddCommand(cmdName, ToggleCharSheet, '', 0);
        Game.CreateCustomKeyBind('C', cmdName);

        // NetTable Listeners
        CustomNetTables.SubscribeNetTableListener('custom_stats' as any, (table, key, data) => {
            if (key === String(Players.GetPlayerHeroEntityIndex(Players.GetLocalPlayer()))) {
                if (isOpen) UpdateAllStats();
            }
        });

        // Event Listener (Fallback / Alternative)
        GameEvents.Subscribe("custom_stats_update", (event: any) => {
             const localHero = Players.GetPlayerHeroEntityIndex(Players.GetLocalPlayer());
             if (event.entindex === localHero) {
                 UpdateStatsFromEvent(event.stats);
             }
        });

        CustomNetTables.SubscribeNetTableListener('economy' as any, (table, key, data) => {
            if (key === `player_${Players.GetLocalPlayer()}`) {
                if (isOpen) UpdateAllStats();
            }
        });

        // Start Loop
        AutoUpdate();
    } catch (e) {
        $.Msg("[CharSheet] Error in init: " + e);
    }
}

// Helper to update from direct object
function UpdateStatsFromEvent(stats: any) {
    if (!stats) return;

    ($('#Val_Constitution') as LabelPanel).text = stats.constitution.toString();
    ($('#Val_Martial') as LabelPanel).text = stats.martial.toString();
    ($('#Val_Divinity') as LabelPanel).text = stats.divinity.toString();

    const rankLevel = stats.rank || 1;
    // @ts-ignore
    const rankInfo = RANK_DATA[rankLevel] || DEFAULT_RANK;
    ($('#Val_Rank') as LabelPanel).text = rankInfo.title;

    // Profession
    const localHero = Players.GetPlayerHeroEntityIndex(Players.GetLocalPlayer());
    const unitName = Entities.GetUnitName(localHero);
    let professionName = "无名小卒";

    // Use Profession from Server
    if (stats.profession) {
        professionName = JOB_NAME_MAP[stats.profession] || stats.profession;
    }
    
    ($('#Val_Profession') as LabelPanel).text = professionName;

    const critChance = stats.crit_chance || 0;
    const critDmg = stats.crit_damage || 150;
    ($('#Val_CritChance') as LabelPanel).text = `${critChance}%`;
    ($('#Val_CritDamage') as LabelPanel).text = `${critDmg}%`;
}

(function () {
    // Delay init by 0.1s to ensure Game context is ready
    $.Schedule(0.1, Init);
})();
