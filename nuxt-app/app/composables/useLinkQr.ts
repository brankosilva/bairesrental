// QR del link personal de un vendedor, para tarjetas/publicidad impresa.
// Sólo cliente: la librería genera vía <canvas>, que no existe en SSR.
export function useLinkQr() {
  async function qrDataUrl(url: string, size = 1024): Promise<string> {
    const QRCode = await import('qrcode')
    return QRCode.toDataURL(url, { width: size, margin: 1 })
  }

  return { qrDataUrl }
}
