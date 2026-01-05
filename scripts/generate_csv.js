
const fs = require('fs');

// Headers based on user provided list (57 columns)
// 1:UnitName, 2:Empty, 3:Empty, 4:BaseClass, 5:Model, 6:Skin, 7:ModelScale
// 8:Creature[{], 9:AttachWearables[{], 10:1 ... 19:10, 20:[}], 21:[}]
// 22:SoundSet, 23:particle_folder, 24:GameSoundsFile, 25:VoiceFile
// 26:Ability1 ... 31:Ability6
// 32:ConsideredHero
// 33:HealthBarOffset
// 34:MovementSpeed, 35:TurnRate, 36:Aggressive, 37:MoveCaps, 38:AttackCaps
// 39:Armor, 40:MagRes, 41:HP, 42:HPRegen, 43:Mana, 44:ManaRegen
// 45:GoldMin, 46:GoldMax, 47:DmgMin, 48:DmgMax, 49:Rate, 50:Point, 51:Range
// 52:Hull, 53:Radius, 54:ProjModel, 55:ProjSpeed, 56:vscripts, 57:HasInventory

const COL_COUNT = 57;

function createRow(data) {
    const row = new Array(COL_COUNT).fill('');
    for (const [colIndex, value] of Object.entries(data)) {
        // colIndex is 1-based, convert to 0-based
        if (colIndex >= 1 && colIndex <= COL_COUNT) {
            row[colIndex - 1] = value;
        }
    }
    return row.join('\t');
}

const baseData = {
    1: 'npc_dota_home_base',
    4: 'npc_dota_building',
    5: 'models/props_structures/radiant_tower002.vmdl',
    7: '1',
    33: '250',
    37: 'DOTA_UNIT_CAP_MOVE_NONE',
    38: 'DOTA_UNIT_CAP_NO_ATTACK',
    39: '20',
    41: '5000',
    42: '10',
    43: '0',
    52: 'DOTA_HULL_SIZE_BUILDING',
    57: '0'
};

const zombieData = {
    1: 'npc_enemy_zombie_lvl1',
    4: 'npc_dota_creature',
    5: 'models/heroes/undying/undying_minion.vmdl',
    7: '1',
    33: '140',
    34: '300',
    37: 'DOTA_UNIT_CAP_MOVE_GROUND',
    38: 'DOTA_UNIT_CAP_MELEE_ATTACK',
    39: '0',
    41: '200',
    42: '1',
    43: '0',
    45: '5',
    46: '10',
    47: '30',
    48: '30',
    49: '1.5',
    50: '0.3',
    51: '100',
    52: 'DOTA_HULL_SIZE_HUMAN',
    57: '0'
};

const output = createRow(baseData) + '\n' + createRow(zombieData);
fs.writeFileSync('temp_excel_data.txt', output);
console.log('Done');
