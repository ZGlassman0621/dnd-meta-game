/**
 * Silence the noisy DEP0040 deprecation warning for Node's built-in `punycode`
 * module. It's emitted by a transitive dependency (whatwg-url — pulled in by the
 * libsql/HTTP client stack) that still does `require('punycode')`. The warning is
 * harmless (punycode still works); it just clutters the server console on every
 * start. We swallow ONLY this one warning and pass everything else through, so
 * genuine deprecation notices still surface.
 *
 * Imported FIRST in server/index.js so the patch is in place before any module
 * that could trigger the warning is evaluated. If/when whatwg-url upstream moves
 * to the userland `punycode` package, this file becomes a harmless no-op and can
 * be deleted.
 */
const originalEmitWarning = process.emitWarning.bind(process);

process.emitWarning = (warning, ...rest) => {
  const opts = rest[0];
  const code = (opts && typeof opts === 'object') ? opts.code : opts;
  const message = typeof warning === 'string' ? warning : (warning && warning.message) || '';
  if (code === 'DEP0040' || /\bpunycode\b/i.test(message)) return;
  return originalEmitWarning(warning, ...rest);
};
