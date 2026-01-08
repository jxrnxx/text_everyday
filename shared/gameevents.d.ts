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
}
