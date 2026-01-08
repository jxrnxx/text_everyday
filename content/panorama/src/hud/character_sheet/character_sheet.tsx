

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

function ToggleCharSheet() {
    $.Msg("[AntiGravity] ToggleCharSheet called! isOpen was: " + isOpen);
    isOpen = !isOpen;
    const panel = $('#CharSheetContainer');
    if (panel) {
        panel.SetHasClass('Hidden', !isOpen);
        $.Msg("[AntiGravity] Toggled class 'Hidden'. Now isOpen: " + isOpen + ", Check class: " + panel.BHasClass('Hidden'));
    } else {
        $.Msg("[AntiGravity] ERROR: Could not find #CharSheetContainer!");
    }

    if (isOpen) {
        UpdateAllStats();
        // Request fresh data via event (Backup for NetTable)
        GameEvents.SendCustomGameEventToServer("request_custom_stats", {} as any);
        Game.EmitSound('ui_menu_activate_open');
    } else {
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
    
    // DEBUG LOG
    $.Msg(`[AntiGravity] UpdateAllStats: LocalHero=${localHero}, Key=${netTableKey}, HasData=${!!netTableData}`);
    if (!netTableData) {
        // Log all keys to see if we have a mismatch
        const allData = CustomNetTables.GetAllTableValues('custom_stats' as any);
        $.Msg(`[AntiGravity] Dumping 'custom_stats' keys: ${JSON.stringify(allData)}`);
    }

    if (netTableData) {
        // Basic Stats
        ($('#Val_Constitution') as LabelPanel).text = (netTableData as any).constitution.toString();
        ($('#Val_Martial') as LabelPanel).text = (netTableData as any).martial.toString();
        ($('#Val_Divinity') as LabelPanel).text = (netTableData as any).divinity.toString();

        // New Stats: Rank, Profession, Crit
        const rankLevel = (netTableData as any).rank || 1;
        // @ts-ignore
        const rankInfo = RANK_DATA[rankLevel] || DEFAULT_RANK;
        
        // Rank
        ($('#Val_Rank') as LabelPanel).text = rankInfo.title;
        // Tooltip for Rank Desc could be added here later
        
        // Profession (Map Hero Name to Title)
        // Profession
        // Check if server sent profession in NetTable
        let professionKey = (netTableData as any).profession;
        let professionName = "-"; // Default to dash if not found

        if (professionKey && professionKey !== "undefined") {
            professionName = JOB_NAME_MAP[professionKey] || professionKey;
        }
        
        ($ as any).Msg("[AntiGravity] NetTable Profession: " + professionName);
        ($('#Val_Profession') as LabelPanel).text = professionName;

        // Crit
        const critChance = (netTableData as any).crit_chance || 0;
        const critDmg = (netTableData as any).crit_damage || 150;
        ($('#Val_CritChance') as LabelPanel).text = `${critChance}%`;
        ($('#Val_CritDamage') as LabelPanel).text = `${critDmg}%`;
    }

    // 2. Economy from NetTable
    const economyData = CustomNetTables.GetTableValue('economy' as any, `player_${Players.GetLocalPlayer()}`);
    if (economyData) {
        ($('#Val_SpiritCoin') as LabelPanel).text = (economyData as any).spirit_coin || '0';
        ($('#Val_Faith') as LabelPanel).text = (economyData as any).faith || '0';
    }

    // 3. Base Stats (API)
    // Damage
    const damageMin = Entities.GetDamageMin(localHero);
    const damageBonus = Entities.GetDamageBonus(localHero);
    const baseDamage = damageMin;

    ($('#Val_DamageBase') as LabelPanel).text = baseDamage.toString();

    if (damageBonus > 0) {
        ($('#Val_DamageBonus') as LabelPanel).text = '+' + damageBonus;
        ($('#Val_DamageBonus') as LabelPanel).visible = true;
    } else {
        ($('#Val_DamageBonus') as LabelPanel).visible = false;
    }

    // Armor
    const armor = Entities.GetPhysicalArmorValue(localHero);
    ($('#Val_Armor') as LabelPanel).text = armor.toFixed(1);

    // Health / Mana
    const hp = Entities.GetHealth(localHero);
    const maxHp = Entities.GetMaxHealth(localHero);
    const mana = Entities.GetMana(localHero);
    const maxMana = Entities.GetMaxMana(localHero);

    ($('#Val_Health') as LabelPanel).text = `${hp} / ${maxHp}`;
    ($('#Val_Mana') as LabelPanel).text = `${mana} / ${maxMana}`;

    // Misc
    // Attacks Per Second is usually 1 / SecondsPerAttack
    const attackTime = Entities.GetSecondsPerAttack(localHero);
    let attacksPerSec = 0;
    if (attackTime > 0) {
        attacksPerSec = 1.0 / attackTime;
    }
    ($('#Val_AtkSpeed') as LabelPanel).text = attacksPerSec.toFixed(2);

    // Move Speed
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
    $.Msg("[AntiGravity] character_sheet.tsx Init executing...");
    
    try {
        // Unregister first to ideally clear old binds (though API doesn't fully support unregistering keybinds cleanly)
        // Game.CreateCustomKeyBind('C', ''); // Hacky try

    // Register Command
        const cmdName = "ToggleCharSheet_" + Math.floor(Math.random() * 10000);
        Game.AddCommand(cmdName, ToggleCharSheet, '', 0);
        Game.CreateCustomKeyBind('C', cmdName);
        $.Msg("[AntiGravity] Registered KeyBind 'C' to command: " + cmdName);

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
                 $.Msg("[AntiGravity] Received custom_stats_update event!");
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
        
        // Heartbeat for debugging
        $.Schedule(1.0, function Heartbeat() {
             $.Msg("[AntiGravity] Character Sheet script alive. IsOpen: " + isOpen);
             $.Schedule(5.0, Heartbeat);
        });
    } catch (e) {
        $.Msg("[AntiGravity] Error in character_sheet init: " + e);
    }
}

// Helper to update from direct object
function UpdateStatsFromEvent(stats: any) {
    $.Msg("[AntiGravity] UpdateStatsFromEvent called. Payload: " + JSON.stringify(stats));
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
    $.Msg("[AntiGravity] character_sheet.tsx loaded. Scheduling Init...");
    // Delay init by 0.1s to ensure Game context is ready
    $.Schedule(0.1, Init);
})();
