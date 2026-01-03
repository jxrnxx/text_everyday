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

    /** Stop custom sounds on client */
    stop_custom_sounds: {};
}
