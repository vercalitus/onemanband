"use client"

export function SpineWatermark() {
  return (
    <div className="pointer-events-none relative mx-auto h-72 w-28 opacity-10">
      <svg viewBox="0 0 120 320" className="h-full w-full text-sky-600" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path
          d="M60 10C47 22 48 39 58 53C67 65 69 81 62 95C56 108 55 122 61 136C67 150 68 164 61 178C54 192 54 207 61 221C68 235 69 250 61 264C53 279 55 295 66 309"
          stroke="currentColor"
          strokeWidth="4"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {[
          [60, 26, 17, 8],
          [60, 44, 19, 8],
          [60, 63, 18, 8],
          [60, 82, 16, 8],
          [60, 101, 17, 8],
          [60, 121, 16, 8],
          [60, 141, 15, 8],
          [60, 161, 15, 8],
          [60, 181, 16, 8],
          [60, 201, 16, 8],
          [60, 221, 17, 8],
          [60, 242, 18, 9],
          [60, 264, 20, 10],
          [60, 289, 23, 11],
        ].map(([cx, cy, rx, ry], index) => (
          <g key={index}>
            <ellipse cx={cx} cy={cy} rx={rx} ry={ry} fill="currentColor" fillOpacity="0.34" />
            <path d={`M${cx - rx - 10} ${cy}H${cx - rx + 2}M${cx + rx - 2} ${cy}H${cx + rx + 10}`} stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
          </g>
        ))}
      </svg>
    </div>
  )
}
