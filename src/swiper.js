// Swiper used to arrive as a global from a CDN script tag, so every slider
// opened by checking whether it had loaded yet. It is part of the bundle now,
// and this file is the one place that says which of its modules the site uses:
// creative and fade effects, the controller that links the approach stacks,
// navigation arrows and autoplay. Adding a Swiper option that needs another
// module means adding it here too.
import Swiper from "swiper";
import { Autoplay, Controller, EffectCreative, EffectFade, Navigation } from "swiper/modules";

Swiper.use([Autoplay, Controller, EffectCreative, EffectFade, Navigation]);

export default Swiper;
