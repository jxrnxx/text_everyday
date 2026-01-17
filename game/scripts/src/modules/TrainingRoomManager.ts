/**
 * Training Room Manager
 * Generates 4 distinct "Floating Island" training rooms based on the "I am not the God of Drama" lore.
 */
export class TrainingRoomManager {
    // Increased spacing for isolation.
    // Map bounds are roughly -8000 to 8000.
    // Placed in bottom-left quadrant.
    private static readonly ROOM_CONFIGS = [
        {
            // Room 0: Aurora Realm (极光界域) - High Tech/Mutant (Green/Cyan)
            center: Vector(-7000, -7000, 128),
            name: '极光界域',
            color: Vector(0, 255, 128), // Teal/Green
            // Use Radiant Ancient (Clean Platform) for everyone as per request
            floorModel: 'models/props_structures/good_ancient001.vmdl',
            floorScale: 6.0, // Massive to cover new radius
            floorZOffset: -180,
            treeModel: 'models/heroes/undying/undying_tower.vmdl',
            propModel: 'models/heroes/rattletrap/rattletrap_world.vmdl',
            pillarModel: 'models/heroes/undying/undying_tower.vmdl',
            ambientParticle: 'particles/units/heroes/hero_viper/viper_nethertoxin.vpcf',
            runeParticle: 'particles/units/heroes/hero_pugna/pugna_ward_ambient.vpcf',
            propScale: 2.0,
            treeScale: 1.2,
        },
        {
            // Room 1: Red Dust Realm (红尘界域) - Celestial/Time (Pink/Purple)
            center: Vector(-3000, -7000, 512),
            name: '红尘界域',
            color: Vector(255, 0, 255), // Magenta
            floorModel: 'models/props_structures/good_ancient001.vmdl',
            floorScale: 6.0,
            floorZOffset: -180,
            treeModel: 'models/heroes/lanaya/lanaya_trap_crystal.vmdl',
            propModel: 'models/heroes/void_spirit/void_spirit_model.vmdl',
            pillarModel: 'models/heroes/void_spirit/void_spirit_remnant.vmdl',
            ambientParticle: 'particles/units/heroes/hero_void_spirit/void_spirit_ambient.vpcf',
            runeParticle: 'particles/units/heroes/hero_void_spirit/void_spirit_entryportal.vpcf',
            propScale: 1.5,
            treeScale: 1.5,
        },
        {
            // Room 2: Wuji Realm (无极界域) - Souls/Refining (Black/Red)
            center: Vector(-7000, -3000, 128),
            name: '无极界域',
            color: Vector(255, 50, 50), // Red
            floorModel: 'models/props_structures/good_ancient001.vmdl', // use clean floor even for dark realm, maybe tint it?
            floorScale: 6.0,
            floorZOffset: -180,
            treeModel: 'models/heroes/shadow_fiend/shadow_fiend_head.vmdl',
            propModel: 'models/heroes/shadow_fiend/shadow_fiend.vmdl',
            pillarModel: 'models/heroes/shadow_demon/shadow_demon.vmdl',
            ambientParticle: 'particles/units/heroes/hero_nevermore/nevermore_shadowraze.vpcf',
            runeParticle: 'particles/units/heroes/hero_doom_bringer/doom_bringer_doom_ring.vpcf',
            propScale: 1.2,
            treeScale: 1.0,
            customTree: 'models/heroes/undying/undying_minion.vmdl',
        },
        {
            // Room 3: Tianshu Realm (天枢界域) - Star/Strategy (Gold/Blue)
            center: Vector(-3000, -3000, 256),
            name: '天枢界域',
            color: Vector(100, 200, 255), // Sky Blue
            floorModel: 'models/props_structures/good_ancient001.vmdl',
            floorScale: 6.0,
            floorZOffset: -180,
            treeModel: 'models/heroes/oracle/oracle.vmdl',
            propModel: 'models/heroes/oracle/oracle.vmdl',
            pillarModel: 'models/props_structures/good_tower001.vmdl',
            ambientParticle: 'particles/units/heroes/hero_keeper_of_the_light/keeper_of_the_light_illuminate_charge.vpcf',
            runeParticle: 'particles/units/heroes/hero_omniknight/omniknight_purification.vpcf',
            propScale: 1.5,
            treeScale: 1.0,
            customTree: 'models/props_structures/good_barracks_melee002.vmdl',
        },
    ];

    private static readonly ROOM_RADIUS = 1300;

    // Tile config for the floor
    private static readonly TILE_MODEL = 'models/props_nature/rock_flat_cluster01a.vmdl'; // Reliable flat rock
    private static readonly TILE_SIZE = 512; // Approx size of the rock at scale 1

    public static Init() {
        for (let i = 0; i < this.ROOM_CONFIGS.length; i++) {
            this.GenerateRoom(i);
        }
    }

    public static GetRespawnPosition(playerID: PlayerID): Vector {
        const index = playerID;
        if (index >= 0 && index < this.ROOM_CONFIGS.length) {
            return this.ROOM_CONFIGS[index].center;
        }
        return Vector(-7000, -7000, 128);
    }

    private static GenerateRoom(index: number) {
        const config = this.ROOM_CONFIGS[index];
        const center = config.center;

        // 1. FLOOR GENERATION
        if (config.name === '天枢界域') {
            // SPECIAL REQUEST: High-Tech Gold Spliced Floor
            // Use Radiant Melee Barracks (Square + Gold Trim) as tiles
            const rows = 4;
            const cols = 4;
            const spacing = 400;
            const startX = center.x - ((cols - 1) * spacing) / 2;
            const startY = center.y - ((rows - 1) * spacing) / 2;

            for (let r = 0; r < rows; r++) {
                for (let c = 0; c < cols; c++) {
                    const tx = startX + c * spacing;
                    const ty = startY + r * spacing;

                    // Use Barracks Base as "Gold Tech Slab"
                    const tile = CreateUnitByName(
                        'npc_dota_dummy_prop_custom',
                        Vector(tx, ty, center.z - 110),
                        false,
                        undefined,
                        undefined,
                        DotaTeam.NOTEAM
                    );
                    if (tile) {
                        const model = 'models/props_structures/good_barracks_melee001.vmdl';
                        tile.SetModel(model);
                        tile.SetOriginalModel(model);
                        tile.SetAbsScale(1.8);
                        tile.SetAbsAngles(0, 90, 0);
                        // Tint to make it look like Gold/Tech material
                        tile.SetRenderColor(255, 230, 150);
                    }
                }
            }
        } else {
            // Keep the "Massive Single Floor" for others
            const floor = CreateUnitByName(
                'npc_dota_dummy_prop_custom',
                Vector(center.x, center.y, center.z - 250),
                false,
                undefined,
                undefined,
                DotaTeam.NOTEAM
            );
            if (floor) {
                const floorModel = 'models/props_structures/good_ancient001.vmdl';
                floor.SetModel(floorModel);
                floor.SetOriginalModel(floorModel);
                floor.SetAbsScale(8.0);
                floor.SetAbsAngles(0, 270, 0);
            }
        }

        // 2. Centerpiece & Tech Effects for Tianshu
        if (config.name === '天枢界域') {
            // High-Tech Centerpiece (The Pink Ancient as a "House")
            const house = CreateUnitByName('npc_dota_dummy_prop_custom', center, false, undefined, undefined, DotaTeam.NOTEAM);
            if (house) {
                house.SetModel('models/props_structures/good_ancient001.vmdl');
                house.SetOriginalModel('models/props_structures/good_ancient001.vmdl');
                house.SetAbsScale(2.5); // BIGGER
                house.SetAbsAngles(0, 270, 0);

                // Tech Ambient Particles (Oracle/Tinker style)
                const p1 = ParticleManager.CreateParticle(
                    'particles/units/heroes/hero_oracle/oracle_fates_edict.vpcf',
                    ParticleAttachment.ABSORIGIN_FOLLOW,
                    house
                );
                const p2 = ParticleManager.CreateParticle(
                    'particles/units/heroes/hero_tinker/tinker_defense_matrix.vpcf',
                    ParticleAttachment.ABSORIGIN_FOLLOW,
                    house
                );
            }

            // Tech Boundary (Floating Crystals instead of rocks?)
            const numEdge = 24;
            for (let i = 0; i < numEdge; i++) {
                const angle = ((i * 360) / numEdge) * (Math.PI / 180);
                const ex = center.x + Math.cos(angle) * this.ROOM_RADIUS * 0.9;
                const ey = center.y + Math.sin(angle) * this.ROOM_RADIUS * 0.9;

                // Tech Pillars/Crystals
                if (i % 2 == 0) {
                    const crystal = CreateUnitByName(
                        'npc_dota_dummy_prop_custom',
                        Vector(ex, ey, center.z + 50),
                        false,
                        undefined,
                        undefined,
                        DotaTeam.NOTEAM
                    );
                    if (crystal) {
                        // Use Ranged Barracks or Tower crystals
                        crystal.SetModel('models/props_structures/good_barracks_ranged001.vmdl');
                        crystal.SetOriginalModel('models/props_structures/good_barracks_ranged001.vmdl');
                        crystal.SetAbsScale(0.8);
                        crystal.SetAbsAngles(0, (angle * 180) / Math.PI + 180, 0);
                        crystal.SetRenderColor(100, 200, 255); // Cyan tint
                    }
                }
            }
        } else {
            // Original Centerpiece for others
            const shrine = CreateUnitByName('npc_dota_dummy_prop_custom', center, false, undefined, undefined, DotaTeam.NOTEAM);
            if (shrine) {
                shrine.SetModel('models/props_structures/good_ancient001.vmdl');
                shrine.SetOriginalModel('models/props_structures/good_ancient001.vmdl');
                shrine.SetAbsScale(1.5);
                shrine.SetAbsAngles(0, 270, 0);
                const p = ParticleManager.CreateParticle(config.ambientParticle, ParticleAttachment.ABSORIGIN_FOLLOW, shrine);
                ParticleManager.SetParticleControl(p, 0, center);
            }
            // Standard Edge
            const numEdge = 36;
            for (let i = 0; i < numEdge; i++) {
                const angle = ((i * 360) / numEdge) * (Math.PI / 180);
                const ex = center.x + Math.cos(angle) * this.ROOM_RADIUS * 0.9;
                const ey = center.y + Math.sin(angle) * this.ROOM_RADIUS * 0.9;
                CreateTempTree(Vector(ex, ey, center.z), 99999);
                if (i % 3 == 0 && (config as any).pillarModel) {
                    const pillar = CreateUnitByName(
                        'npc_dota_dummy_prop_custom',
                        Vector(ex, ey, center.z),
                        false,
                        undefined,
                        undefined,
                        DotaTeam.NOTEAM
                    );
                    if (pillar) {
                        pillar.SetModel((config as any).pillarModel);
                        pillar.SetOriginalModel((config as any).pillarModel);
                        pillar.SetAbsScale(1.2);
                        pillar.SetAbsAngles(0, (angle * 180) / Math.PI + 180, 0);
                    }
                }
                const p = ParticleManager.CreateParticle(
                    'particles/units/heroes/hero_cloud/cloud_base_smoke.vpcf',
                    ParticleAttachment.WORLDORIGIN,
                    undefined
                );
                ParticleManager.SetParticleControl(p, 0, Vector(ex, ey, center.z - 50));
            }
        }

        // 3. Spawning Units
        this.SpawnCreeps(center, config.name);
    }

    private static SpawnCreeps(center: Vector, roomName: string) {
        // ... (Similar creep logic, maybe varying types based on room?)
        const creepCount = 8;
        const necCount = 1;
        const team = DotaTeam.BADGUYS; // Target practice

        for (let i = 0; i < creepCount; i++) {
            const offsetX = RandomInt(-400, 400);
            const offsetY = RandomInt(-400, 400);
            const pos = Vector(center.x + offsetX, center.y + offsetY, center.z);

            const unit = CreateUnitByName('npc_dota_creep_lane', pos, true, undefined, undefined, team);
            if (unit) {
                unit.SetAbsAngles(0, RandomFloat(0, 360), 0);
            }
        }

        // Spawn NEC
        for (let i = 0; i < necCount; i++) {
            const unit = CreateUnitByName(
                'npc_dota_necronomicon_warrior_1',
                Vector(center.x + 200, center.y + 200, center.z),
                true,
                undefined,
                undefined,
                team
            );
            if (unit) {
                unit.SetAbsAngles(0, RandomFloat(0, 360), 0);
            }
        }
    }
}
