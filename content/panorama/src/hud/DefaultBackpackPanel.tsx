import React from 'react';

// 背包配置
const PUBLIC_STORAGE_COLS = 8;
const PUBLIC_STORAGE_ROWS = 2;
const PUBLIC_STORAGE_SIZE = PUBLIC_STORAGE_COLS * PUBLIC_STORAGE_ROWS; // 16格

const PRIVATE_BAG_COLS = 8;
const PRIVATE_BAG_ROWS = 5;
const PRIVATE_BAG_SIZE = PRIVATE_BAG_COLS * PRIVATE_BAG_ROWS; // 40格

const CELL_SIZE = 48;
const CELL_GAP = 2;

const CELL_TOTAL = CELL_SIZE + CELL_GAP * 2;
const GRID_INNER_WIDTH = PUBLIC_STORAGE_COLS * CELL_TOTAL; // 416px

// 按钮配置 - 前两个大，最后一个小
const BUTTONS = [
    { id: 'combine_equip', text: '合成装备', width: 140, height: 44 },
    { id: 'combine_skill', text: '合成技能', width: 140, height: 44 },
    { id: 'tidy_up', text: '整理', width: 95, height: 44 },
];

// 样式定义 - 墨玉(Dark Jade)主题
const styles = {
    // ===== 外层总框 =====
    outerFrame: {
        flowChildren: 'down' as const,
        width: `${GRID_INNER_WIDTH + 32}px`, // 448px
        height: '500px', // 减少高度
        position: '1230px 330px 0px' as const, // 往下50px
        padding: '6px',
        backgroundColor: 'gradient(linear, 0% 0%, 0% 100%, from(#002a32ee), to(#00080add))',
        border: '2px solid #b8860b',
        borderRadius: '4px',
        boxShadow: '0px 4px 20px rgba(0, 0, 0, 0.6)',
    },

    // ===== 内层容器 =====
    innerContainer: {
        flowChildren: 'down' as const,
        width: '100%',
        height: '100%',
    },

    // ===== 单个仓库区域 =====
    storageSection: {
        flowChildren: 'down' as const,
        width: '100%',
        marginBottom: '4px',
    },

    // 标题栏 - 金色渐变背景
    sectionTitleBar: {
        width: '100%',
        height: '32px',
        backgroundColor: 'gradient(linear, 0% 0%, 100% 0%, from(#00000000), color-stop(0.5, #b8860b44), to(#00000000))',
        border: '1px solid rgba(184, 134, 11, 0.3)',
        borderRadius: '2px',
        flowChildren: 'down' as const,
        padding: '5px 0px 0px 0px',
    },

    // 标题文字
    sectionTitle: {
        horizontalAlign: 'center' as const,
        textAlign: 'center' as const,
        width: '100%',
        fontSize: '14px',
        fontWeight: 'bold' as const,
        letterSpacing: '5px',
        textShadow: '0px 1px 3px rgba(0, 0, 0, 0.8)',
        color: '#f0e68c',
    },

    // 标题横线
    titleUnderline: {
        width: '70%',
        height: '1px',
        horizontalAlign: 'center' as const,
        marginTop: '2px',
        backgroundColor: 'gradient(linear, 0% 50%, 100% 50%, from(rgba(184, 134, 11, 0)), color-stop(0.3, rgba(218, 165, 32, 0.6)), color-stop(0.5, rgba(255, 215, 0, 0.8)), color-stop(0.7, rgba(218, 165, 32, 0.6)), to(rgba(184, 134, 11, 0)))',
    },

    // 格子区域框
    gridFrame: {
        width: `${GRID_INNER_WIDTH + 12}px`,
        marginTop: '3px',
        backgroundColor: '#001a1fcc',
        border: '1px solid #2f4f4f',
        borderRadius: '2px',
        padding: '4px',
        boxShadow: 'inset 0px 1px 4px rgba(0, 0, 0, 0.5)',
        horizontalAlign: 'center' as const,
    },

    // 格子容器
    gridContainer: {
        width: `${GRID_INNER_WIDTH}px`,
        flowChildren: 'right-wrap' as const,
    },

    // 单个物品格子 - 雕刻感
    itemCell: {
        width: `${CELL_SIZE}px`,
        height: `${CELL_SIZE}px`,
        margin: `${CELL_GAP}px`,
        backgroundColor: '#00000088', // 更深
        border: '1px solid #454545', // 微妙灰色边框
        borderRadius: '3px',
        boxShadow: 'inset 0px 0px 8px #000000', // 内凹阴影
    },

    // ===== 底部按钮区域 =====
    buttonBar: {
        width: `${GRID_INNER_WIDTH + 12}px`,
        height: '55px',
        marginTop: '4px',
        flowChildren: 'right' as const,
        horizontalAlign: 'center' as const,
        verticalAlign: 'center' as const,
        backgroundColor: 'transparent', // 移除背景和边框
    },

    // 按钮图片样式
    buttonImage: {
        backgroundImage: 'url("file://{images}/custom_game/hud/backpack_button_jade.png")',
        backgroundSize: '100% 100%' as const,
        backgroundRepeat: 'no-repeat' as const,
        borderRadius: '4px',
        border: '1px solid #b8860b',
        boxShadow: '0px 2px 6px rgba(0, 0, 0, 0.4)',
    },

    // 按钮文字
    buttonText: {
        horizontalAlign: 'center' as const,
        verticalAlign: 'center' as const,
        textAlign: 'center' as const,
        width: '100%',
        height: '50%',
        fontSize: '14px',
        fontWeight: 'bold' as const,
        letterSpacing: '2px',
        textShadow: '0px 1px 3px rgba(0, 0, 0, 0.9)',
        color: '#ffd700',
    },
};

// 空物品格子组件
function EmptyCell({ index }: { index: number }) {
    return (
        <Panel style={styles.itemCell} />
    );
}

// 单个仓库区域组件
interface StorageSectionProps {
    title: string;
    cellCount: number;
    keyPrefix: string;
}

function StorageSection({ title, cellCount, keyPrefix }: StorageSectionProps) {
    const cells = [];
    for (let i = 0; i < cellCount; i++) {
        cells.push(<EmptyCell key={`${keyPrefix}_${i}`} index={i} />);
    }

    return (
        <Panel style={styles.storageSection}>
            <Panel style={styles.sectionTitleBar}>
                <Label style={styles.sectionTitle} text={title} />
                <Panel style={styles.titleUnderline} />
            </Panel>
            <Panel style={styles.gridFrame}>
                <Panel style={styles.gridContainer}>
                    {cells}
                </Panel>
            </Panel>
        </Panel>
    );
}

// 按钮组件 - 支持不同大小和边距
function ActionButton({ id, text, width, height, marginLeft = 0 }: { id: string; text: string; width: number; height: number; marginLeft?: number }) {
    const handleClick = () => {
        $.Msg(`[Backpack] Button clicked: ${id}`);
    };

    const wrapperStyle = {
        width: `${width}px`,
        height: `${height}px`,
        marginLeft: `${marginLeft}px`,
        marginRight: '3px',
    };

    const imageStyle = {
        ...styles.buttonImage,
        width: '100%',
        height: '100%',
    };

    return (
        <Panel style={wrapperStyle}>
            <Button style={imageStyle} onactivate={handleClick}>
                <Label style={styles.buttonText} text={text} />
            </Button>
        </Panel>
    );
}

// 主背包组件
export function DefaultBackpackPanel() {
    return (
        <Panel style={styles.outerFrame}>
            <Panel style={styles.innerContainer}>
                <StorageSection
                    title="公用仓库"
                    cellCount={PUBLIC_STORAGE_SIZE}
                    keyPrefix="public"
                />

                <StorageSection
                    title="私人背包"
                    cellCount={PRIVATE_BAG_SIZE}
                    keyPrefix="private"
                />

                <Panel style={styles.buttonBar}>
                    <ActionButton
                        id="combine_equip"
                        text="合成装备"
                        width={130}
                        height={44}
                        marginLeft={0}
                    />
                    <ActionButton
                        id="combine_skill"
                        text="合成技能"
                        width={130}
                        height={44}
                        marginLeft={34}
                    />
                    <ActionButton
                        id="tidy_up"
                        text="整理"
                        width={90}
                        height={44}
                        marginLeft={34}
                    />
                </Panel>
            </Panel>
        </Panel>
    );
}
