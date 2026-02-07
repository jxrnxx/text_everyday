import { openPanel, markPanelClosed, registerPanel, closeCurrentPanel } from '../PanelManager';

// ===== 使用统一的属性工具 =====
import {
    RANK_CONFIG,
    getLocalizedJobName,
    getRawStats,
    getHeroStats,
    calculatePanelStat,
    type RawStatsData,
    type PanelStats,
} from '../../utils/StatsUtils';

// 默认阶位
const DEFAULT_RANK = { name: '凡胎', color: '#aaaaaa', desc: '肉眼凡胎，受困于世。' };

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

    if (netTableData) {
        const d = netTableData as any;

        // 基础信息 (0=凡胎, 1=觉醒...)
        const rankLevel = d.rank ?? 0;
        // 使用服务端控制的 display_level（而不是引擎等级）
        const level = d.display_level ?? Entities.GetLevel(localHero);

        // @ts-ignore
        const rankInfo = RANK_CONFIG[rankLevel] || DEFAULT_RANK;
        ($('#Val_Rank') as LabelPanel).text = rankInfo.name;

        let professionKey = d.profession;
        const professionName = getLocalizedJobName(professionKey, "-");
        ($('#Val_Profession') as LabelPanel).text = professionName;
        ($('#Val_Level') as LabelPanel).text = level.toString();

        // ===== 15个属性字段 =====

        // 根骨 (Constitution) - 公式: (基础 + (等级-1)*成长 + 额外) * (1 + 加成)
        const conBase = d.constitution_base || 0;
        const conGain = d.constitution_gain || 0;
        const conBonus = d.constitution_bonus || 0;
        const conExtra = d.extra_constitution || 0;
        const conPanel = Math.floor((conBase + (level - 1) * conGain + conExtra) * (1 + conBonus));
        ($('#Val_Con_Base') as LabelPanel).text = conBase.toString();
        ($('#Val_Con_Gain') as LabelPanel).text = conGain.toString();
        ($('#Val_Con_Bonus') as LabelPanel).text = conBonus.toString();
        ($('#Val_Con_Panel') as LabelPanel).text = conPanel.toString();

        // 武道 (Martial) - 公式: (基础 + (等级-1)*成长 + 额外) * (1 + 加成)
        const marBase = d.martial_base || 0;
        const marGain = d.martial_gain || 0;
        const marBonus = d.martial_bonus || 0;
        const marExtra = d.extra_martial || 0;
        const marPanel = Math.floor((marBase + (level - 1) * marGain + marExtra) * (1 + marBonus));
        ($('#Val_Mar_Base') as LabelPanel).text = marBase.toString();
        ($('#Val_Mar_Gain') as LabelPanel).text = marGain.toString();
        ($('#Val_Mar_Bonus') as LabelPanel).text = marBonus.toString();
        ($('#Val_Mar_Panel') as LabelPanel).text = marPanel.toString();

        // 神念 (Divinity) - 公式: (基础 + (等级-1)*成长 + 额外) * (1 + 加成)
        const divBase = d.divinity_base || 0;
        const divGain = d.divinity_gain || 0;
        const divBonus = d.divinity_bonus || 0;
        const divExtra = d.extra_divinity || 0;
        const divPanel = Math.floor((divBase + (level - 1) * divGain + divExtra) * (1 + divBonus));
        ($('#Val_Div_Base') as LabelPanel).text = divBase.toString();
        ($('#Val_Div_Gain') as LabelPanel).text = divGain.toString();
        ($('#Val_Div_Bonus') as LabelPanel).text = divBonus.toString();
        ($('#Val_Div_Panel') as LabelPanel).text = divPanel.toString();

        // 身法 (Agility) - 公式: (基础 + (等级-1)*成长 + 额外) * (1 + 加成)
        const agiBase = d.agility_base || 0;
        const agiGain = d.agility_gain || 0;
        const agiBonus = d.agility_bonus || 0;
        const agiExtra = d.extra_agility || 0;
        const agiPanel = Math.floor((agiBase + (level - 1) * agiGain + agiExtra) * (1 + agiBonus));
        ($('#Val_Agi_Base') as LabelPanel).text = agiBase.toString();
        ($('#Val_Agi_Gain') as LabelPanel).text = agiGain.toString();
        ($('#Val_Agi_Bonus') as LabelPanel).text = agiBonus.toString();
        ($('#Val_Agi_Panel') as LabelPanel).text = agiPanel.toString();

        // 攻击力 (Damage) - 公式: (基础 + (等级-1)*成长 + 额外) * (1 + 加成) + 主属性*1.5
        const dmgBase = d.damage_base || 0;
        const dmgGain = d.damage_gain || 0;
        const dmgBonus = d.damage_bonus || 0;
        const dmgExtra = d.extra_base_damage || 0;
        const dmgPanel = Math.floor((dmgBase + (level - 1) * dmgGain + dmgExtra) * (1 + dmgBonus));
        ($('#Val_Dmg_Base') as LabelPanel).text = dmgBase.toString();
        ($('#Val_Dmg_Gain') as LabelPanel).text = dmgGain.toString();
        ($('#Val_Dmg_Bonus') as LabelPanel).text = dmgBonus.toString();

        // 主属性计算 (主属性*1.5)
        const mainStat = d.main_stat || 'Martial';
        const mainPanel = mainStat === 'Martial' ? marPanel : divPanel;
        const totalDmg = dmgPanel + Math.floor(mainPanel * 1.5);
        ($('#Val_Dmg_Panel') as LabelPanel).text = totalDmg.toString();
        ($('#Val_Attack_Display') as LabelPanel).text = totalDmg.toString();

        // Crit
        const critChance = d.crit_chance || 0;
        const critDmg = d.crit_damage || 150;
        ($('#Val_CritChance') as LabelPanel).text = `${critChance}%`;
        ($('#Val_CritDamage') as LabelPanel).text = `${critDmg}%`;

        // 破势 (护甲穿透)
        const armorPen = d.armor_pen || 0;
        ($('#Val_ArmorPen') as LabelPanel).text = armorPen.toString();

        // 攻击回血
        const lifeOnHit = d.life_on_hit || 0;
        const lifeOnHitBase = d.life_on_hit_base || 0;
        ($('#Val_LifeOnHit') as LabelPanel).text = lifeOnHit.toString();

        // 游戏获取 (商店/技能/装备获得的额外属性)
        const extraAtkSpeed = d.extra_attack_speed || 0;
        const extraManaRegen = d.extra_mana_regen || 0;
        const extraArmor = d.extra_armor || 0;
        const extraLifeOnHit = lifeOnHit - lifeOnHitBase;  // 额外回血 = 面板 - 基础
        const extraDamage = d.extra_base_damage || 0;

        ($('#Val_Shop_AtkSpeed') as LabelPanel).text = extraAtkSpeed.toString();
        ($('#Val_Shop_ManaRegen') as LabelPanel).text = extraManaRegen.toString();
        ($('#Val_Shop_Armor') as LabelPanel).text = extraArmor.toString();
        ($('#Val_Shop_LifeOnHit') as LabelPanel).text = extraLifeOnHit.toString();
        ($('#Val_Shop_Damage') as LabelPanel).text = extraDamage.toString();

        // 计算攻速面板值
        const panelAtkSpeed = 100 + agiPanel + extraAtkSpeed;
        ($('#Val_AtkSpeed') as LabelPanel).text = panelAtkSpeed.toString();

        // 公式说明 - 使用正确的公式（包含额外获得值）
        const mainStatCN = mainStat === 'Martial' ? '武道' : '神念';
        ($('#Debug_Con') as LabelPanel).text = `根骨: (${conBase}+(${level}-1)×${conGain}+${conExtra})×(1+${conBonus}) = ${conPanel}`;
        ($('#Debug_Mar') as LabelPanel).text = `武道: (${marBase}+(${level}-1)×${marGain}+${marExtra})×(1+${marBonus}) = ${marPanel}`;
        ($('#Debug_Div') as LabelPanel).text = `神念: (${divBase}+(${level}-1)×${divGain}+${divExtra})×(1+${divBonus}) = ${divPanel}`;
        ($('#Debug_Agi') as LabelPanel).text = `身法: (${agiBase}+(${level}-1)×${agiGain}+${agiExtra})×(1+${agiBonus}) = ${agiPanel}`;
        ($('#Debug_Dmg') as LabelPanel).text = `攻击: ${dmgPanel} + 主属(${mainStatCN}${mainPanel})×1.5 = ${totalDmg}`;
        ($('#Debug_AtkSpeed') as LabelPanel).text = `攻速: 100 + 身法${agiPanel} + 额外${extraAtkSpeed} = ${panelAtkSpeed}`;
        ($('#Debug_HP') as LabelPanel).text = `生命: 根骨面板(${conPanel})×30 + 基础1 = ${conPanel * 30 + 1}`;

        // 移速公式 - 从 NetTable 读取基础移速
        const agiMoveBonus = Math.floor(agiPanel * 0.4);
        const baseMoveSpeed = d.base_move_speed || 300;
        const extraMoveSpeed = d.extra_move_speed || 0;
        const panelMoveSpeed = baseMoveSpeed + agiMoveBonus + extraMoveSpeed;
        ($('#Debug_MoveSpeed') as LabelPanel).text = `移速: ${baseMoveSpeed} + 身法${agiPanel}×0.4=${agiMoveBonus} + 额外${extraMoveSpeed} = ${panelMoveSpeed}`;
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
    }
}

// Helper function to safely set label text
function safeSetText(selector: string, text: string) {
    const panel = $(selector) as LabelPanel;
    if (panel) {
        panel.text = text;
    }
}

// Helper to update from direct object
function UpdateStatsFromEvent(stats: any) {
    if (!stats) return;

    const localHero = Players.GetPlayerHeroEntityIndex(Players.GetLocalPlayer());
    // 使用服务端控制的 display_level（而不是引擎等级）
    const level = stats.display_level ?? Entities.GetLevel(localHero);
    const rankLevel = stats.rank ?? 0;

    // 根骨面板值计算
    const conBase = stats.constitution_base || 0;
    const conGain = stats.constitution_gain || 0;
    const conBonus = stats.constitution_bonus || 0;
    const conExtra = stats.extra_constitution || 0;
    const conPanel = Math.floor((conBase + (level - 1) * conGain + conExtra) * (1 + conBonus));
    safeSetText('#Val_Con_Panel', conPanel.toString());

    // 武道面板值计算
    const marBase = stats.martial_base || 0;
    const marGain = stats.martial_gain || 0;
    const marBonus = stats.martial_bonus || 0;
    const marExtra = stats.extra_martial || 0;
    const marPanel = Math.floor((marBase + (level - 1) * marGain + marExtra) * (1 + marBonus));
    safeSetText('#Val_Mar_Panel', marPanel.toString());

    // 神念面板值计算
    const divBase = stats.divinity_base || 0;
    const divGain = stats.divinity_gain || 0;
    const divBonus = stats.divinity_bonus || 0;
    const divExtra = stats.extra_divinity || 0;
    const divPanel = Math.floor((divBase + (level - 1) * divGain + divExtra) * (1 + divBonus));
    safeSetText('#Val_Div_Panel', divPanel.toString());

    // rankLevel 已在函数开头定义
    // @ts-ignore
    const rankInfo = RANK_CONFIG[rankLevel] || DEFAULT_RANK;
    safeSetText('#Val_Rank', rankInfo.name);

    // Profession
    let professionName = "无名小卒";
    if (stats.profession) {
        professionName = getLocalizedJobName(stats.profession, "无名小卒");
    }
    safeSetText('#Val_Profession', professionName);

    const critChance = stats.crit_chance || 0;
    const critDmg = stats.crit_damage || 150;
    safeSetText('#Val_CritChance', `${critChance}%`);
    safeSetText('#Val_CritDamage', `${critDmg}%`);
}

(function () {
    // Delay init by 0.1s to ensure Game context is ready
    $.Schedule(0.1, Init);
})();
