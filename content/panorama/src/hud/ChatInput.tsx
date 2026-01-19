import type { FC } from 'react';
import React, { useState, useEffect, useRef } from 'react';

/**
 * 自定义聊天输入组件
 * 用于替代原生聊天框，支持调试命令
 */
const ChatInput: FC = () => {
    const [isOpen, setIsOpen] = useState(false);
    const [inputValue, setInputValue] = useState('');
    const [messages, setMessages] = useState<string[]>([]);

    // 监听 F5 键打开聊天框
    useEffect(() => {
        const panelId = 'ChatInputPanel';
        const panel = $.GetContextPanel();

        // 注册按键事件
        Game.AddCommand('custom_chat_toggle', () => {
            setIsOpen(prev => !prev);
        }, '', 0);

        // 绑定 F5 键
        Game.CreateCustomKeyBind('key_f5', 'custom_chat_toggle');

        return () => {
            // 清理
        };
    }, []);

    const handleSubmit = () => {
        if (!inputValue.trim()) {
            setIsOpen(false);
            return;
        }

        const text = inputValue.trim();

        // 发送聊天消息到服务器
        GameEvents.SendCustomGameEventToServer('to_server_chat_message' as any, {
            message: text
        });

        // 添加到本地消息列表
        setMessages(prev => [...prev.slice(-4), text]);
        setInputValue('');
        setIsOpen(false);

        // 释放焦点
        $.DispatchEvent('DropInputFocus');
    };

    const handleCancel = () => {
        setInputValue('');
        setIsOpen(false);
        $.DispatchEvent('DropInputFocus');
    };

    if (!isOpen) {
        return (
            <Panel style={{
                position: '20px 0px 0px' as const,
                verticalAlign: 'bottom',
                marginBottom: '10px',
                flowChildren: 'down' as const,
            }}>
                {/* 显示最近的消息 */}
                {messages.map((msg, i) => (
                    <Label
                        key={i}
                        text={msg}
                        style={{
                            fontSize: '16px',
                            color: '#ffffff',
                            backgroundColor: 'rgba(0, 0, 0, 0.5)',
                            padding: '4px 8px',
                            marginBottom: '2px',
                            borderRadius: '4px',
                        }}
                    />
                ))}
                <Label
                    text="按 F5 打开聊天"
                    style={{
                        fontSize: '14px',
                        color: 'rgba(255, 255, 255, 0.5)',
                        marginTop: '5px',
                    }}
                />
            </Panel>
        );
    }

    return (
        <Panel
            hittest={true}
            style={{
                position: '20px 0px 0px' as const,
                verticalAlign: 'bottom',
                marginBottom: '10px',
                flowChildren: 'right' as const,
            }}
        >
            <TextEntry
                text={inputValue}
                ontextentrychange={e => setInputValue(e.text)}
                style={{
                    width: '400px',
                    height: '36px',
                    backgroundColor: 'rgba(0, 0, 0, 0.8)',
                    border: '1px solid #5e6869',
                    color: '#ffffff',
                    fontSize: '16px',
                    padding: '4px 8px',
                    borderRadius: '4px',
                }}
                placeholder="输入消息或命令..."
                multiline={false}
                // @ts-ignore
                oninputsubmit={handleSubmit}
                // @ts-ignore
                oncancel={handleCancel}
            />
            <Button
                onactivate={handleSubmit}
                style={{
                    width: '60px',
                    height: '36px',
                    marginLeft: '8px',
                    backgroundColor: '#4a90d9',
                    borderRadius: '4px',
                }}
            >
                <Label text="发送" style={{ align: 'center center', color: '#ffffff' }} />
            </Button>
        </Panel>
    );
};

export default ChatInput;
