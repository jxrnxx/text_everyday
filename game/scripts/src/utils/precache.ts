/** @noSelfInFile */
// 导出的预载入方法，用来给addon_game_mode.ts调用
export default function Precache(context: CScriptPrecacheContext) {
    // 需要预载的所有资源
    precacheResource(
        [
            // Aurora
            'models/heroes/undying/undying_tower.vmdl',
            'models/heroes/rattletrap/rattletrap_world.vmdl',
            'particles/units/heroes/hero_viper/viper_nethertoxin.vpcf',
            // "models/props_nature/rock_flat_cluster01a.vmdl", // REMOVED (ERROR)
            'models/props_structures/bad_ancient001.vmdl',
            'particles/units/heroes/hero_pugna/pugna_ward_ambient.vpcf',
            // Red Dust
            'models/heroes/lanaya/lanaya_trap_crystal.vmdl',
            'models/heroes/void_spirit/void_spirit_model.vmdl',
            'models/heroes/void_spirit/void_spirit_remnant.vmdl',
            'particles/units/heroes/hero_void_spirit/void_spirit_ambient.vpcf',
            'models/props_structures/good_ancient001.vmdl', // CENTERPIECE

            // Wuji
            'models/heroes/shadow_fiend/shadow_fiend.vmdl',
            'models/heroes/undying/undying_minion.vmdl',
            'models/heroes/shadow_demon/shadow_demon.vmdl', // Pillar
            'particles/units/heroes/hero_nevermore/nevermore_shadowraze.vpcf',
            'particles/units/heroes/hero_doom_bringer/doom_bringer_doom_ring.vpcf',
            // Tianshu
            'models/heroes/oracle/oracle.vmdl',
            'models/props_structures/good_barracks_melee002.vmdl',
            'models/props_structures/good_barracks_melee001.vmdl', // GOLD TECH FLOOR
            'models/props_structures/good_barracks_ranged001.vmdl', // TECH PILLAR
            'models/props_structures/good_tower001.vmdl',
            'particles/units/heroes/hero_keeper_of_the_light/keeper_of_the_light_illuminate_charge.vpcf',
            'particles/units/heroes/hero_omniknight/omniknight_purification.vpcf',
            'particles/units/heroes/hero_oracle/oracle_fates_edict.vpcf', // TECH RUNE
            'particles/units/heroes/hero_tinker/tinker_defense_matrix.vpcf', // TECH SHIELD

            // General
            'models/development/invisiblebox.vmdl',
            'particles/units/heroes/hero_cloud/cloud_base_smoke.vpcf',

            // Soldier Path
            'particles/units/heroes/hero_sven/sven_spell_great_cleave_gods_strength.vpcf',
            'particles/units/heroes/hero_juggernaut/jugg_crit_blur.vpcf',
            'particles/units/heroes/hero_juggernaut/juggernaut_crit_tgt.vpcf',
            // Soldier War Strike New
            'particles/econ/items/juggernaut/jugg_arcana/juggernaut_arcana_trigger_crit_red.vpcf',
            'particles/units/heroes/hero_dragon_knight/dragon_knight_breathe_fire.vpcf',
            'particles/units/heroes/hero_nevermore/nevermore_shadowraze.vpcf',
            // Martial Cleave (横扫) - white cleave arc
            'particles/units/heroes/hero_sven/sven_spell_great_cleave.vpcf',

            // Cultivation Merchant
            'models/props_gameplay/shopkeeper_fountain/shopkeeper_fountain.vmdl',

            // Ability Shop Merchant
            'models/heroes/shopkeeper/shopkeeper.vmdl',

            // Blink Dash - 使用幽灵假人法，无需粒子特效

            // Artifact Upgrade Effects (per-tier colors)
            'particles/artifact_upgrade_t1.vpcf',
            'particles/artifact_upgrade_t2.vpcf',
            'particles/artifact_upgrade_t3.vpcf',
            'particles/artifact_upgrade_t4.vpcf',
            'particles/artifact_upgrade_t5.vpcf',

            // NPC Overhead Nameplate
            'particles/npc_overhead_nameplate.vpcf',
            'particles/npc_overhead_nameplate_ability.vpcf',

            // Sound Events
            'soundevents/custom_game/custom_soundevents.vsndevts',
        ],
        context
    );
    // 需要预载入的kv文件，会自动解析KV文件中的所有vpcf资源等等
    precacheEveryResourceInKV(
        [
            // kv文件路径
            'npc_abilities_custom.txt',
        ],
        context
    );
    // 需要预载入的单位
    precacheUnits(
        [
            // 单位名称
            'npc_creep_train_tier1', // 练功房怪物
        ],
        context
    );
    // 需要预载入的物品
    precacheItems(
        [
            // 物品名称
            // 'item_***',
        ],
        context
    );
}

// 预载入KV文件中的所有资源
function precacheEveryResourceInKV(kvFileList: string[], context: CScriptPrecacheContext) {
    kvFileList.forEach(file => {
        const kvTable = LoadKeyValues(file);
        precacheEverythingFromTable(kvTable, context);
    });
}
// 预载入资源列表
function precacheResource(resourceList: string[], context: CScriptPrecacheContext) {
    resourceList.forEach(resource => {
        precacheResString(resource, context);
    });
}
function precacheResString(res: string, context: CScriptPrecacheContext) {
    if (res.endsWith('.vpcf')) {
        PrecacheResource('particle', res, context);
    } else if (res.endsWith('.vsndevts')) {
        PrecacheResource('soundfile', res, context);
    } else if (res.endsWith('.vmdl')) {
        PrecacheResource('model', res, context);
    }
}

// 预载入单位列表
function precacheUnits(unitNamesList: string[], context?: CScriptPrecacheContext) {
    if (context != null) {
        unitNamesList.forEach(unitName => {
            PrecacheUnitByNameSync(unitName, context);
        });
    } else {
        unitNamesList.forEach(unitName => {
            PrecacheUnitByNameAsync(unitName, () => { });
        });
    }
}
// 预载入物品列表
function precacheItems(itemList: string[], context: CScriptPrecacheContext) {
    itemList.forEach(itemName => {
        PrecacheItemByNameSync(itemName, context);
    });
}

// 一个辅助的，从KV表中解析出所有资源并预载入的方法
function precacheEverythingFromTable(kvTable: any, context: CScriptPrecacheContext) {
    if (!kvTable) return;
    for (const [k, v] of pairs(kvTable)) {
        if (type(v) === 'table') {
            precacheEverythingFromTable(v, context);
        } else if (type(v) === 'string') {
            precacheResString(v, context);
        }
    }
}
