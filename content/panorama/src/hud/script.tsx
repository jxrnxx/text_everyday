import 'panorama-polyfill-x/lib/console';
import 'panorama-polyfill-x/lib/timers';

// Hello World!
console.log(`Hello, world!`);

/** 以下代码均为为范例代码，可以自行删除 */
console.log(`content/panorama/src/hud/script.tsx -> 以下代码均为示例代码，可以自行删除`);

/** 隐藏一些默认的UI元素 */
import '../utils/hide-default-hud';

import { type FC } from 'react';
import { render } from 'react-panorama-x';
import GameTimer from './GameTimer';
import InvitationCode from './InvitationCode';
import EconomyDisplay from './EconomyDisplay';
import TrainingButtons from './TrainingButtons';

const Root: FC = () => {
    return (
        <>
            <GameTimer />
            <InvitationCode />
            <EconomyDisplay />
            <TrainingButtons />
        </>
    );
};

render(<Root />, $.GetContextPanel());

// Helper: Reload Scripts with 'R' (Only in Tools Mode)
if (Game.IsInToolsMode()) {
    $.RegisterKeyBind($.GetContextPanel(), 'key_r', () => {
        Game.ServerCmd('dota_reload_addon_script');
    });
}

// Global Key Binds for Training Room
// We are moving keybind logic to 'custom_keybinds.js' to avoid UI script errors and conflicts.
// The debug buttons below remain for mouse-based testing.
