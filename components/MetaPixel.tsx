import { META_PIXEL_ID } from "@/lib/meta-pixel";

/**
 * Base Meta Pixel script, rendered on every page via app/layout.tsx. Renders
 * nothing when NEXT_PUBLIC_META_PIXEL_ID is unset (e.g. a build without the
 * variable configured), so the build never breaks over a missing pixel.
 *
 * Fires the first PageView itself, inline, so it counts even before React
 * hydrates. Subsequent PageViews (this site navigates client-side via
 * next/link, so the browser never reloads between pages) come from
 * MetaPixelPageView below.
 */
export function MetaPixel() {
  if (!META_PIXEL_ID) return null;

  return (
    <>
      {/* eslint-disable-next-line react/no-danger */}
      <script
        dangerouslySetInnerHTML={{
          __html: `!function(f,b,e,v,n,t,s)
{if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};
if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';
n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];
s.parentNode.insertBefore(t,s)}(window, document,'script',
'https://connect.facebook.net/en_US/fbevents.js');
fbq('init', '${META_PIXEL_ID}');
fbq('track', 'PageView');`,
        }}
      />
      <noscript>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          height="1"
          width="1"
          alt=""
          style={{ display: "none" }}
          src={`https://www.facebook.com/tr?id=${META_PIXEL_ID}&ev=PageView&noscript=1`}
        />
      </noscript>
    </>
  );
}
