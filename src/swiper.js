// Swiper used to arrive as a global from a CDN script tag, so every slider
// opened by checking whether it had loaded yet. It is part of the bundle now,
// and this file is the one place that says which of its modules the site uses:
// creative and fade effects, the controller that links the approach stacks,
// navigation arrows and autoplay. Adding a Swiper option that needs another
// module means adding it here too.
//
// THE VERSION IS PINNED, EXACTLY, IN package.json. Swiper's CSS is not in this
// bundle: it is a separate <script>-tag stylesheet in Webflow's head, pinned to
// one version. A caret range here would let npm move the JavaScript on any
// install while that stylesheet stayed put, and the two would drift apart with
// nothing to say so. Changing the version means changing it in both places.
import Swiper from "swiper";
import { Autoplay, Controller, EffectCreative, EffectFade, Navigation } from "swiper/modules";

Swiper.use([Autoplay, Controller, EffectCreative, EffectFade, Navigation]);

export default Swiper;
