import React from 'react';

const TrainingButtons = () => {
    // Style definition
    // Using simple object styles as requested by User's AI and proven safe patterns.
    const btnStyle = {
        width: '80px',
        height: '140px',
        backgroundSize: '100% 100%',
        backgroundRepeat: 'no-repeat',
        margin: '10px',
        boxShadow: '0px 0px 10px 0px #000000aa',
    };

    // Paths verified to exist in game/dota_addons/text_everyday/panorama/images/custom_game/
    // Using {resources} mapping which points to the addon root content
    const trainStyle = {
        ...btnStyle,
        backgroundImage: 'url("file://{resources}/images/custom_game/training_enter.png")',
    };

    const homeStyle = {
        ...btnStyle,
        backgroundImage: 'url("file://{resources}/images/custom_game/training_exit.png")',
    };

    const labelStyle = {
        color: 'white',
        fontSize: '20px',
        fontWeight: 'bold',
        textShadow: '0px 0px 2px 2.0 #000000',
        align: 'center center',
        marginTop: '80px', // Align text to lower part of talisman
        textAlign: 'center',
    } as const;

    // Command handlers
    const sendEnter = () => GameEvents.SendCustomGameEventToServer('cmd_c2s_train_enter', {});
    const sendExit = () => GameEvents.SendCustomGameEventToServer('cmd_c2s_train_exit', {});

    return (
        <Panel
            hittest={false} // Container doesn't block clicks
            style={{
                flowChildren: 'right',
                verticalAlign: 'bottom',
                horizontalAlign: 'center',
                marginRight: '650px',
                marginBottom: '0px',
            }}
        >
            {/* Train Button */}
            <Button onactivate={sendEnter} style={trainStyle}>
                <Label text="练功" style={labelStyle} />
                <Label text="[F3]" style={{ ...labelStyle, fontSize: '12px', marginTop: '110px', color: '#ccc' }} />
            </Button>

            {/* Home Button */}
            <Button onactivate={sendExit} style={homeStyle}>
                <Label text="回城" style={labelStyle} />
                <Label text="[F4]" style={{ ...labelStyle, fontSize: '12px', marginTop: '110px', color: '#ccc' }} />
            </Button>
        </Panel>
    );
};

export default TrainingButtons;
