// PROTOTYPE (throwaway): keyframes shared by the home variants. Motion only under no-preference.
export function ProtoStyles() {
  return (
    <style>{`
      .proto-cycle > span { opacity: 0; }
      .proto-cycle > span:first-child { opacity: 1; }
      .proto-check { opacity: 0; }
      @media (prefers-reduced-motion: no-preference) {
        @keyframes proto-float { 0%,100% { transform: translate3d(0,0,0) } 50% { transform: translate3d(18px,-22px,0) } }
        @keyframes proto-marquee { to { transform: translateX(-50%) } }
        @keyframes proto-rise { from { opacity: 0; transform: translateY(18px) } to { opacity: 1; transform: none } }
        @keyframes proto-cycle { 0% { opacity: 0; transform: translateY(10px) } 4%,22% { opacity: 1; transform: none } 26%,100% { opacity: 0; transform: translateY(-10px) } }
        @keyframes proto-tick { 0%,8% { opacity: 0; transform: scale(.4) } 14%,70% { opacity: 1; transform: scale(1) } 80%,100% { opacity: 0; transform: scale(.4) } }
        @keyframes proto-shine { to { background-position: 200% center } }
        .proto-float { animation: proto-float 11s ease-in-out infinite }
        .proto-marquee { animation: proto-marquee 38s linear infinite }
        .proto-marquee-rev { animation: proto-marquee 46s linear infinite reverse }
        .proto-rise { opacity: 0; animation: proto-rise .7s cubic-bezier(.2,.7,.2,1) forwards }
        .proto-cycle > span { animation: proto-cycle 10s infinite both }
        .proto-check { animation: proto-tick 6s infinite both }
        .proto-shine { background-size: 200% auto; animation: proto-shine 6s linear infinite }
      }
    `}</style>
  );
}
