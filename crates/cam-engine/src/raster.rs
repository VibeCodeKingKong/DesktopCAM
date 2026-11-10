use crate::gcode::fmt;
use crate::Post;

const BAYER4: [u8; 16] = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];

/// Returnerar 1 = bränn, 0 = hoppa över.
pub fn dither_bits(gray: &[u8], w: usize, h: usize, method: &str, threshold: u8) -> Vec<u8> {
    let mut out = vec![0u8; w * h];
    match method {
        "threshold" => {
            for i in 0..out.len().min(gray.len()) {
                out[i] = (gray[i] < threshold) as u8;
            }
        }
        "ordered" => {
            for y in 0..h {
                for x in 0..w {
                    let t = (BAYER4[(y % 4) * 4 + (x % 4)] as f32 + 0.5) * 16.0;
                    out[y * w + x] = ((gray[y * w + x] as f32) < t) as u8;
                }
            }
        }
        _ => {
            // Floyd–Steinberg
            let mut buf: Vec<f32> = gray.iter().map(|&g| g as f32).collect();
            let th = threshold as f32;
            for y in 0..h {
                for x in 0..w {
                    let i = y * w + x;
                    let old = buf[i];
                    let nv = if old < th { 0.0 } else { 255.0 };
                    out[i] = (nv == 0.0) as u8;
                    let err = old - nv;
                    if x + 1 < w {
                        buf[i + 1] += err * 7.0 / 16.0;
                    }
                    if y + 1 < h {
                        if x > 0 {
                            buf[i + w - 1] += err * 3.0 / 16.0;
                        }
                        buf[i + w] += err * 5.0 / 16.0;
                        if x + 1 < w {
                            buf[i + w + 1] += err / 16.0;
                        }
                    }
                }
            }
        }
    }
    out
}

#[allow(clippy::too_many_arguments)]
pub fn raster_gcode(bits: &[u8], w: usize, h: usize, ps: f64, ox: f64, oy: f64, feed: f64, laser_s: f64, post: &Post) -> String {
    let f = |v: f64| fmt(v, post.decimals);
    let mut out: Vec<String> = vec!["; desktopCAM laser raster".into()];
    out.extend(post.header.iter().cloned());
    out.push("G21".into());
    out.push("G90".into());
    out.push(format!("{} S0", if post.laser_dynamic_power { "M4" } else { "M3" }));
    let mut first_feed = true;
    for row in 0..h {
        let y = oy + (h - 1 - row) as f64 * ps;
        let mut runs: Vec<(usize, usize)> = Vec::new();
        let mut col = 0;
        while col < w {
            if bits[row * w + col] == 1 {
                let st = col;
                while col < w && bits[row * w + col] == 1 {
                    col += 1;
                }
                runs.push((st, col));
            } else {
                col += 1;
            }
        }
        if runs.is_empty() {
            continue;
        }
        let ltr = row % 2 == 0;
        if !ltr {
            runs.reverse();
        }
        for (a, b) in runs {
            let xa = ox + a as f64 * ps;
            let xb = ox + b as f64 * ps;
            let (from, to) = if ltr { (xa, xb) } else { (xb, xa) };
            out.push(format!("G0 X{} Y{} S0", f(from), f(y)));
            let feed_part = if first_feed { format!(" F{}", f(feed)) } else { String::new() };
            first_feed = false;
            out.push(format!("G1 X{} S{}{}", f(to), f(laser_s), feed_part));
        }
    }
    out.push("M5".into());
    out.extend(post.footer.iter().cloned());
    out.join("\n") + "\n"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn black_pixels_burn_white_pixels_skip() {
        let gray = [0u8, 255, 0, 255];
        assert_eq!(dither_bits(&gray, 2, 2, "threshold", 128), vec![1, 0, 1, 0]);
    }
}
