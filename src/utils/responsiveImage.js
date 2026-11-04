// Transform only the image CDN whose width parameter we already use.
// Uploaded files, SVGs and arbitrary third-party URLs keep their exact source.
export function responsiveImage(src, sizes = '(max-width: 640px) 80vw, 400px') {
  if (!src) return {};
  try {
    const image = new URL(src);
    if (image.protocol !== 'https:' || image.hostname !== 'images.unsplash.com') return {};
    const widths = [320, 640, 960, 1440];
    return {
      srcSet: widths.map(width => {
        const variant = new URL(image);
        variant.searchParams.set('w', String(width));
        variant.searchParams.set('auto', 'format');
        return `${variant.href} ${width}w`;
      }).join(', '),
      sizes,
    };
  } catch {
    return {};
  }
}
