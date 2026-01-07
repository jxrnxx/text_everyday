
import React, { useEffect, useState } from 'react';
import { useNetTableKey } from 'react-panorama-x';

const EconomyDisplay = () => {
    const localPlayerID = Players.GetLocalPlayer();
    const [spiritCoin, setSpiritCoin] = useState(0);
    const [faith, setFaith] = useState(0);

    useEffect(() => {
        // Initial fetch from NetTable (still useful for initial state)
        const tableData = CustomNetTables.GetTableValue("economy", `player_${localPlayerID}`);
        if (tableData) {
            setSpiritCoin(tableData.spirit_coin || 0);
            setFaith(tableData.faith || 0);
        }

        // 1. Listen to NetTable (Backup / Sync)
        const netTableListener = CustomNetTables.SubscribeNetTableListener("economy", (tableName, key, value) => {
            if (key === `player_${localPlayerID}` && value) {
                setSpiritCoin(value.spirit_coin || 0);
                setFaith(value.faith || 0);
            }
        });

        // 2. Listen to Game Event (Fast / Real-time)
        const eventListener = GameEvents.Subscribe("economy_update", (event) => {
            // $.Msg(`[EconomyDisplay] Event Received: ${JSON.stringify(event)}`);
            if (event.player_id === localPlayerID) {
                setSpiritCoin(event.spirit_coin);
                setFaith(event.faith);
            }
        });

        return () => {
             CustomNetTables.UnsubscribeNetTableListener(netTableListener);
             GameEvents.Unsubscribe(eventListener);
        };
    }, [localPlayerID]);

    return (
        <Panel style={styles.container}>
            {/* Spirit Coin Display */}
            <Panel style={styles.resourceRow}>
                <Label text="精神币:" style={styles.labelCoin} />
                <Label text={spiritCoin.toString()} style={styles.valueCoin} />
            </Panel>

            {/* Faith Display */}
            <Panel style={styles.resourceRow}>
                <Label text="信仰值:" style={styles.labelFaith} />
                <Label text={faith.toString()} style={styles.valueFaith} />
            </Panel>
        </Panel>
    );
};

const styles = {
    container: {
        flowChildren: "down",
        horizontalAlign: "right",
        marginTop: "60px", 
        marginRight: "10px",
        backgroundColor: "#000000aa",
        padding: "10px",
        borderRadius: "5px",
        width: "200px",
    },
    
    resourceRow: {
        flowChildren: "right",
        width: "100%",
        marginBottom: "5px",
    },

    labelCoin: {
        color: "#FFD700", // Gold
        fontSize: "18px",
        fontWeight: "bold" as const,
        verticalAlign: "center",
        width: "60%",
    },

    valueCoin: {
        color: "#FFFFFF",
        fontSize: "20px",
        fontWeight: "bold" as const,
        verticalAlign: "center",
        textAlign: "right" as const,
        width: "40%",
    },

    labelFaith: {
        color: "#FF4444", // Red
        fontSize: "18px",
        fontWeight: "bold" as const,
        verticalAlign: "center",
        width: "60%",
    },

    valueFaith: {
        color: "#FFFFFF",
        fontSize: "20px",
        fontWeight: "bold" as const,
        verticalAlign: "center",
        textAlign: "right" as const,
        width: "40%",
    },
};

export default EconomyDisplay;
