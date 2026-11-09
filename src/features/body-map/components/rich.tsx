/**
 * Help text with **bold** stretches, so the start of each instruction and the
 * thing to remember can be found at a glance. The markers live in the
 * translations, so each language bolds its own words.
 */
export function Rich({ text }: { text: string }) {
  return (
    <>
      {text.split(/\*\*(.+?)\*\*/g).map((part, i) =>
        i % 2 ? (
          <strong key={i} className="font-semibold text-slate-900">
            {part}
          </strong>
        ) : (
          part
        ),
      )}
    </>
  )
}
