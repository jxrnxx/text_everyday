let isOpen = false;

function ToggleCharSheet() {
    $.Msg("[AntiGravity] ToggleCharSheet called");
    isOpen = !isOpen;
    $('#CharSheetContainer').SetHasClass('Hidden', !isOpen);

    if (isOpen) {
        UpdateAllStats();
        Game.EmitSound('ui_menu_activate_open');
    } else {
        Game.EmitSound('ui_menu_activate_close');
    }
}

// Expose to Global for XML button (Close Button)
($.GetContextPanel() as any).ToggleCharSheet = ToggleCharSheet;

function UpdateAllStats() {
    const localHero = Players.GetPlayerHeroEntityIndex(Players.GetLocalPlayer());
    if (localHero === -1) return;

    // 1. Custom Stats from NetTable
    const netTableData = CustomNetTables.GetTableValue('custom_stats' as any, String(localHero));
    if (netTableData) {
        ($('#Val_Constitution') as LabelPanel).text = (netTableData as any).constitution.toString();
        ($('#Val_Martial') as LabelPanel).text = (netTableData as any).martial.toString();
        ($('#Val_Divinity') as LabelPanel).text = (netTableData as any).divinity.toString();
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
(function () {
    $.Msg("[AntiGravity] character_sheet.tsx loaded");
    
    try {
        Game.AddCommand('ToggleCharSheetCmd', ToggleCharSheet, '', 0);
        Game.CreateCustomKeyBind('C', 'ToggleCharSheetCmd');
        $.Msg("[AntiGravity] Keybind 'C' registered for ToggleCharSheetCmd");

        // NetTable Listeners
        CustomNetTables.SubscribeNetTableListener('custom_stats' as any, (table, key, data) => {
            if (key === String(Players.GetPlayerHeroEntityIndex(Players.GetLocalPlayer()))) {
                if (isOpen) UpdateAllStats();
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
        $.Msg("[AntiGravity] Error in character_sheet init: " + e);
    }
})();
