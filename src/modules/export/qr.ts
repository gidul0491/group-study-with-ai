import QRCode from "qrcode";

/** URL을 SVG 문자열로. 화면에 innerHTML로 넣거나 data URL로 쓴다. */
export async function qrSvg(url: string): Promise<string> {
  return QRCode.toString(url, {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    color: { dark: "#3a2e24", light: "#fffaf2" },
  });
}
