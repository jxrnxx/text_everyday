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

const Root: FC = () => {
    return (
        <>
            <GameTimer />
            <InvitationCode />
        </>
    );
};

render(<Root />, $.GetContextPanel());
