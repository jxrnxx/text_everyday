declare interface CustomGameEventDeclarations {
    /**
     * 在前后端之间（UI的ts代码和游戏逻辑的ts代码之间）传递的事件，需要在此处声明事件的参数类型
     *  events and it's parameters between ui and game mode typescript code should be declared here
     */
    c2s_test_event: { key: string };
    c2s_test_event_with_params: {
        foo: number;
        bar: string;
    };

    /** Send verification code to server */
    to_server_verify_code: {
        code: string;
    };

    /** Receive verification result from server */
    from_server_verify_result: {
        success: boolean;
        message?: string;
    };
    // Training Room Events
    cmd_c2s_train_enter: {};
    cmd_c2s_train_exit: {};

    // Blink Dash Event (D Key)
    cmd_c2s_blink_dash: {
        x: number;
        y: number;
        z: number;
    };

    /** Stop custom sounds on client */
    stop_custom_sounds: {};

    /** Sync game timer start time */
    update_game_timer_start: {
        startTime: number;
    };

    /** Reset game timer to 0 */
    reset_game_timer: {};

    /** Economy update (SpiritCoin/Faith) */
    economy_update: {
        player_id: PlayerID;
        spirit_coin: number;
        faith: number;
    };

    /** Custom Stats Update (Server -> Client) */
    custom_stats_update: {
        entindex: number;
        stats: any; // Using any to avoid sharing complex HeroStats interface for now
    };

    /** Request Custom Stats (Client -> Server) */
    request_custom_stats: {};

    // ===== Progression Constraints System Events =====
    /** Request rank up (Client -> Server) */
    cmd_attempt_rank_up: {};

    /** Test rank up - bypass checks (Client -> Server) */
    cmd_test_rank_up: {};

    /** Rank up result (Server -> Client) */
    rank_up_result: {
        success: boolean;
        new_rank: number;
        message: string;
    };

    /** Open merchant panel for specific shop (Server -> Client) */
    open_merchant_panel: {
        shop_id: number;
    };

    /** Open ability shop panel (Server -> Client) */
    open_ability_shop: {
        shop_id: number;
    };

    /** Request stat breakthrough (Client -> Server) */
    cmd_request_breakthrough: {
        target_tier: number;
    };

    /** Breakthrough result (Server -> Client) */
    breakthrough_result: {
        success: boolean;
        new_tier: number;
        message: string;
    };

    /** Merchant purchase stat (Client -> Server) */
    cmd_merchant_purchase: {
        stat_type: string;
        amount: number;
        slot_index: number;
    };

    /** Refresh merchant UI after breakthrough (Server -> Client) */
    refresh_merchant_ui: {
        new_tier: number;
        tier_name: string;
        message?: string;
        at_tier_cap?: boolean;
    };

    /** End game (Client -> Server) */
    cmd_end_game: {};

    /** Hero changed (Server -> Client) */
    hero_changed: {
        newHeroIndex: number;
    };

    /** Wave state changed (Server -> Client) */
    wave_state_changed: {
        currentWave: number;
        totalWaves: number;
        state: string;
        nextWaveTime: number;
        countdownEndTime: number; // 倒计时结束的绝对游戏时间
        isSpawning: boolean;
        canPause: boolean;
    };

    /** Wave started (Server -> Client) */
    wave_started: {
        waveNumber: number;
        waveType: string;
        isBossWave: boolean;
    };

    /** Wave completed (Server -> Client) */
    wave_completed: {
        waveNumber: number;
    };

    // ===== Knapsack System Events =====
    /** Show knapsack panel (Server -> Client) */
    show_knapsack: {};

    /** Hide knapsack panel (Server -> Client) */
    hide_knapsack: {};

    /** Toggle knapsack panel (Server -> Client) */
    toggle_knapsack: {};

    /** Use item in knapsack (Client -> Server) */
    knapsack_use_item: {
        index: number;
        targetIndex: EntityIndex;
    };

    /** Swap items in knapsack (Client -> Server) */
    knapsack_swap_item: {
        index_in: number;
        index_out: number;
    };

    /** Drop item from knapsack (Client -> Server) */
    knapsack_drop_item: {
        index: number;
        position: Vector;
    };

    /** Tidy up knapsack (Client -> Server) */
    knapsack_tidy_up: {};

    /** Decompose items in knapsack (Client -> Server) */
    knapsack_decompose: {};

    /** Custom toast message (Server -> Client) */
    custom_toast: {
        message: string;
        duration: number;
    };

    /** Ability shop purchase (Client -> Server) */
    cmd_ability_shop_purchase: {
        item_id: number;
        item_name: string;
        price: number;
        currency: string;
    };

    /** Skill replace prompt - slots full (Server -> Client) */
    skill_replace_prompt: {
        skill_to_learn: string;
        skill_book_name: string;
        available_slots: string[];
        occupied_slots: { slot: number; key: string; abilityName: string }[];
        storage_type: 'public' | 'private';
        item_index: number;
    };

    /** Skill replace confirm (Client -> Server) */
    cmd_skill_replace_confirm: {
        slot_key: string;
        skill_to_learn: string;
        storage_type: 'public' | 'private';
        item_index: number;
    };
}
