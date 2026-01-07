
import React, { FC, useState } from 'react';
import { useGameEvent } from '../hooks/useGameEvent';

const InvitationCode: FC = () => {
    const [inputValue, setInputValue] = useState('');
    const [isVerified, setIsVerified] = useState(false);
    const [errorMsg, setErrorMsg] = useState('');
    const [isChecking, setIsChecking] = useState(false);

    // Listen for verification result from server
    useGameEvent('from_server_verify_result', (event: CustomGameEventDeclarations['from_server_verify_result']) => {
        setIsChecking(false);
        if (event.success) {
            setIsVerified(true);
        } else {
            setErrorMsg(event.message || '验证失败');
        }
    });

    // Listen for stop sound event
    useGameEvent('stop_custom_sounds', () => {
        console.log("Server requested to stop custom sounds.");
        // Game.StopSound requires an ID returned by EmitSound, so we cannot stop global sounds by name here easily.
        // We rely on the server to StopSoundOn the client entity.
    });

    const handleSubmit = () => {
        if (!inputValue) return;
        setIsChecking(true);
        setErrorMsg('');
        GameEvents.SendCustomGameEventToServer('to_server_verify_code', { code: inputValue });
    };

    if (isVerified) {
        return null; // Hide component if verified
    }

    return (
        <Panel
            hittest={true}
            className="invitation-root"
        >
            {/* Centered Dialog */}
            <Panel className="invitation-dialog">
                <Label
                    text="欢迎来到修仙世界"
                    className="invitation-title"
                />
                
                <Panel style={{ width: '80%', height: '2px', backgroundColor: 'gradient( linear, 0% 0%, 100% 0%, from(rgba(255,255,255,0)), color-stop(0.5, #c2a060), to(rgba(255,255,255,0)) )', horizontalAlign: 'center', marginBottom: '30px' }} />

                <Label
                    text="请输入验证码"
                    style={{
                        fontSize: '20px',
                        color: '#b0b0b0',
                        horizontalAlign: 'center',
                        marginBottom: '30px',
                        letterSpacing: '2px',
                    }}
                />

                <Panel className="invitation-input-container">
                    <TextEntry
                        text={inputValue}
                        ontextentrychange={(e) => {
                            setInputValue(e.text);
                            setErrorMsg('');
                        }}
                        style={{
                            width: '320px',
                            height: '50px',
                            backgroundColor: 'rgba(0, 0, 0, 0.6)',
                            border: '1px solid #5e6869',
                            color: '#e6e6e6',
                            fontSize: '24px',
                            padding: '8px 16px',
                            verticalAlign: 'center',
                            borderRadius: '4px',
                        }}
                        placeholder="..."
                        multiline={false}
                        // @ts-ignore
                        oninputsubmit={handleSubmit} // 支持回车提交
                    />
                    <Button
                        onactivate={handleSubmit}
                        style={{
                            height: '50px',
                            width: '120px',
                            marginLeft: '15px',
                            backgroundColor: 'gradient( linear, 0% 0%, 0% 100%, from( #d4af37 ), to( #aa8822 ) )', // Gold gradient
                            border: '1px solid #f0e6d2',
                            borderRadius: '4px',
                            boxShadow: '0px 0px 10px 0px rgba(212, 175, 55, 0.3)',
                        }}
                    >
                        <Label
                            text={isChecking ? "验证中..." : "提交"}
                            style={{
                                color: '#2b1d0e',
                                fontSize: '22px',
                                fontWeight: 'bold',
                                align: 'center center',
                                textShadow: 'none',
                            }}
                        />
                    </Button>
                </Panel>

                {errorMsg ? (
                    <Label
                        text={errorMsg}
                        style={{
                            color: '#FF6E6E',
                            fontSize: '18px',
                            horizontalAlign: 'center',
                            marginTop: '15px',
                            textShadow: '0px 1px 2px 2.0 #000000',
                        }}
                    />
                ) : null}
            </Panel>
            
            {/* Footer / Version / Copyright if needed */}
            <Label 
                text="Powered by AntiGravity" 
                style={{ 
                    align: 'center bottom', 
                    marginBottom: '20px', 
                    color: 'rgba(255,255,255,0.3)', 
                    fontSize: '14px' 
                }} 
            />
        </Panel>
    );
};

export default InvitationCode;
