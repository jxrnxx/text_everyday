declare interface CustomNetTableDeclarations {
    game_timer: {
        game_timer: {
            current_time: number;
            current_state: 1 | 2 | 3 | 4 | 5;
            current_round: number;
        };
    };
    hero_list: {
        hero_list: Record<string, string> | string[];
    };
    economy: {
        [key: string]: {
            spirit_coin: number;
            faith: number;
        };
    };
    custom_net_table_1: {
        key_1: number;
        key_2: string;
    };
    custom_net_table_3: {
        key_1: number;
        key_2: string;
    };
    wave_state: {
        current: {
            wave: number;
            total: number;
            state: string;
            nextWaveTime: number;
        };
    };
    upgrade_system: {
        [key: string]: {
            current_tier: number;
            tier_name: string;
            cost_per_slot: number;
            slots_purchased: { [key: number]: boolean };
            slots_config: {
                [key: number]: {
                    stat_type: string;
                    name: string;
                    value: number;
                    is_percent?: boolean;
                };
            };
        };
    };
    knapsack: {
        [key: string]: {
            [slotIndex: string]: {
                itemName: string;
                itemId: number;
                charges: number;
                stackable: boolean;
                icon?: string;
            } | null;
        };
    };
    public_storage: {
        [key: string]: {
            [slotIndex: string]: {
                itemName: string;
                itemId: number;
                charges: number;
                stackable: boolean;
                icon?: string;
            } | null;
        };
    };
    private_backpack: {
        [key: string]: {
            [slotIndex: string]: {
                itemName: string;
                itemId: number;
                charges: number;
                stackable: boolean;
                icon?: string;
            } | null;
        };
    };
    custom_stats: {
        [key: string]: any;
    };
}
