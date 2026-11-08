//! desktopCAM CAM-motor.
//!
//! Exporteras till JavaScript med wasm-bindgen och körs i en Web Worker.
//! Varje funktion här har en motsvarighet i `packages/core/src/referenceEngine.ts`
//! och ska ge identisk G-kod.

use serde::Deserialize;
use wasm_bindgen::prelude::*;

mod gcode;
mod geometry;
mod raster;
mod relief;

pub use geometry::offset_polygon;
pub use raster::dither_bits;

#[derive(Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct Post {
    pub header: Vec<String>,
    pub footer: Vec<String>,
    pub decimals: usize,
    pub safe_z: f64,
    pub laser_dynamic_power: bool,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct ProfileParams {
    offset: f64,
    mode: String,
    cut_depth: f64,
    step_down: f64,
    feed_rate: f64,
    plunge_rate: f64,
    spindle_rpm: f64,
    laser_s: f64,
    passes: u32,
    post: Post,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
struct RasterParams {
    pixel_size_mm: f64,
    origin_x: f64,
    origin_y: f64,
    feed_rate: f64,
    laser_s: f64,
    post: Post,
}

fn parse<T: for<'de> Deserialize<'de>>(json: &str) -> Result<T, JsError> {
    serde_json::from_str(json).map_err(|e| JsError::new(&format!("Ogiltiga parametrar: {e}")))
}

#[wasm_bindgen]
pub fn engine_version() -> String {
    env!("CARGO_PKG_VERSION").to_string()
}

/// `points` = alla polylinjers koordinater efter varandra (x,y,x,y…),
/// `counts` = antal punkter per polylinje, `closed` = 1/0 per polylinje.
#[wasm_bindgen]
pub fn profile_gcode(points: &[f64], counts: &[u32], closed: &[u8], params_json: &str) -> Result<String, JsError> {
    let p: ProfileParams = parse(params_json)?;
    if counts.len() != closed.len() {
        return Err(JsError::new("counts och closed måste ha samma längd"));
    }
    let mut polys = Vec::with_capacity(counts.len());
    let mut cursor = 0usize;
    for (i, &count) in counts.iter().enumerate() {
        let n = count as usize;
        let end = cursor + n * 2;
        if end > points.len() {
            return Err(JsError::new("För få koordinater för angivna counts"));
        }
        let pts: Vec<(f64, f64)> = points[cursor..end].chunks_exact(2).map(|c| (c[0], c[1])).collect();
        cursor = end;
        let is_closed = closed[i] == 1;
        let pts = if is_closed { offset_polygon(&pts, p.offset) } else { pts };
        polys.push((is_closed, pts));
    }

    let opts = gcode::ProfileOptions {
        laser: p.mode == "laser",
        cut_depth: p.cut_depth,
        step_down: p.step_down,
        feed_rate: p.feed_rate,
        plunge_rate: p.plunge_rate,
        spindle_rpm: p.spindle_rpm,
        laser_s: p.laser_s,
        passes: p.passes.max(1),
    };
    Ok(gcode::profile(&polys, &opts, &p.post))
}

#[wasm_bindgen]
pub fn dither(gray: &[u8], width: u32, height: u32, method: &str, threshold: u8) -> Vec<u8> {
    dither_bits(gray, width as usize, height as usize, method, threshold)
}

#[wasm_bindgen]
pub fn raster_gcode(bits: &[u8], width: u32, height: u32, params_json: &str) -> Result<String, JsError> {
    let p: RasterParams = parse(params_json)?;
    let (w, h) = (width as usize, height as usize);
    if bits.len() != w * h {
        return Err(JsError::new("Bildens storlek stämmer inte med bitmappen"));
    }
    Ok(raster::raster_gcode(bits, w, h, p.pixel_size_mm, p.origin_x, p.origin_y, p.feed_rate, p.laser_s, &p.post))
}

/// 3D-bana för en relief. `heights` = höjdkarta 0…1 (rad för rad nerifrån).
#[wasm_bindgen]
pub fn relief_gcode(heights: &[f32], params_json: &str) -> Result<String, JsError> {
    let p: relief::ReliefParams = parse(params_json)?;
    if p.nx < 2 || p.ny < 2 || heights.len() != p.nx * p.ny {
        return Err(JsError::new("Höjdkartans storlek stämmer inte"));
    }
    Ok(relief::relief_gcode(heights, &p))
}
