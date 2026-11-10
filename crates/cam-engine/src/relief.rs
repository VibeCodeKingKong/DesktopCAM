//! 3D-banor för reliefer med "drop cutter". Speglar packages/core/src/reliefToolpath.ts.

use crate::gcode::{depth_passes, fmt};
use crate::Post;
use serde::Deserialize;

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReliefTool {
    pub kind: String,
    pub diameter: f64,
    pub angle: Option<f64>,
}

#[derive(Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ReliefParams {
    pub nx: usize,
    pub ny: usize,
    pub x: f64,
    pub y: f64,
    pub width: f64,
    pub height: f64,
    pub depth: f64,
    pub tool: ReliefTool,
    pub step_over_mm: f64,
    pub rough_step_over_mm: f64,
    pub direction: String,
    pub roughing: bool,
    pub step_down: f64,
    pub allowance: f64,
    pub feed_rate: f64,
    pub plunge_rate: f64,
    pub spindle_rpm: f64,
    pub post: Post,
}

type Pt3 = (f64, f64, f64);

fn profile_offset(kind: &str, r: f64, angle: f64, d: f64) -> f64 {
    match kind {
        "ballnose" => r - (r * r - d * d).max(0.0).sqrt(),
        "vbit" => d / (angle.to_radians() / 2.0).tan(),
        _ => 0.0,
    }
}

pub struct DropCutter<'a> {
    h: &'a [f32],
    p: &'a ReliefParams,
    dx: f64,
    dy: f64,
    r: f64,
    angle: f64,
}

impl<'a> DropCutter<'a> {
    pub fn new(h: &'a [f32], p: &'a ReliefParams) -> Self {
        let angle = p.tool.angle.filter(|a| *a > 0.0).unwrap_or(90.0);
        DropCutter {
            h,
            p,
            dx: p.width / (p.nx as f64 - 1.0),
            dy: p.height / (p.ny as f64 - 1.0),
            r: p.tool.diameter / 2.0,
            angle,
        }
    }

    pub fn z(&self, px: f64, py: f64) -> f64 {
        let p = self.p;
        let r = self.r;
        let kind = p.tool.kind.as_str();
        let mut best = f64::NEG_INFINITY;
        let edge = (px - p.x).min(p.x + p.width - px).min(py - p.y).min(p.y + p.height - py);
        if edge < r {
            best = -profile_offset(kind, r, self.angle, edge.max(0.0));
        }
        let i0 = ((px - r - p.x) / self.dx).ceil().max(0.0) as usize;
        let i1 = ((px + r - p.x) / self.dx).floor().min(p.nx as f64 - 1.0);
        let j0 = ((py - r - p.y) / self.dy).ceil().max(0.0) as usize;
        let j1 = ((py + r - p.y) / self.dy).floor().min(p.ny as f64 - 1.0);
        if i1 >= 0.0 && j1 >= 0.0 {
            for j in j0..=(j1 as usize) {
                let ddy = p.y + j as f64 * self.dy - py;
                for i in i0..=(i1 as usize) {
                    let d = ((p.x + i as f64 * self.dx - px).powi(2) + ddy * ddy).sqrt();
                    if d > r {
                        continue;
                    }
                    let z = (self.h[j * p.nx + i] as f64 - 1.0) * p.depth - profile_offset(kind, r, self.angle, d);
                    if z > best {
                        best = z;
                    }
                }
            }
        }
        if best == f64::NEG_INFINITY { 0.0 } else { best.min(0.0) }
    }
}

fn simplify(pts: Vec<Pt3>, tol: f64) -> Vec<Pt3> {
    if pts.len() < 3 {
        return pts;
    }
    let mut out = vec![pts[0]];
    for i in 1..pts.len() - 1 {
        let a = *out.last().unwrap();
        let b = pts[i + 1];
        let p = pts[i];
        let span = ((b.0 - a.0).powi(2) + (b.1 - a.1).powi(2)).sqrt();
        let t = if span > 0.0 { ((p.0 - a.0).powi(2) + (p.1 - a.1).powi(2)).sqrt() / span } else { 0.0 };
        if (p.2 - (a.2 + (b.2 - a.2) * t)).abs() > tol {
            out.push(p);
        }
    }
    out.push(pts[pts.len() - 1]);
    out
}

fn raster_rows(p: &ReliefParams, step_over: f64, z_at: &dyn Fn(f64, f64) -> f64) -> Vec<Vec<Pt3>> {
    let along_x = p.direction == "x";
    let across = if along_x { p.height } else { p.width };
    let along_n = if along_x { p.nx } else { p.ny };
    let along = if along_x { p.width } else { p.height };
    let rows = ((across / step_over - 1e-9).ceil() as usize).max(1) + 1;
    let mut out = Vec::with_capacity(rows);
    for k in 0..rows {
        let c = (k as f64 * step_over).min(across);
        let mut row: Vec<Pt3> = (0..along_n)
            .map(|i| {
                let a = along * i as f64 / (along_n as f64 - 1.0);
                let (px, py) = if along_x { (p.x + a, p.y + c) } else { (p.x + c, p.y + a) };
                (px, py, z_at(px, py))
            })
            .collect();
        if k % 2 == 1 {
            row.reverse();
        }
        out.push(simplify(row, 0.005));
    }
    out
}

pub fn relief_gcode(h: &[f32], p: &ReliefParams) -> String {
    let post = &p.post;
    let f = |v: f64| fmt(v, post.decimals);
    let drop = DropCutter::new(h, p);
    let mut out: Vec<String> = vec!["; desktopCAM relief".into()];
    out.extend(post.header.iter().cloned());
    out.push("G21".into());
    out.push("G90".into());
    out.push(format!("M3 S{}", p.spindle_rpm.round() as i64));
    out.push(format!("G0 Z{}", f(post.safe_z)));

    let mut passes: Vec<Vec<Vec<Pt3>>> = Vec::new();
    if p.roughing {
        for level in depth_passes(p.depth, p.step_down) {
            let z_at = |x: f64, y: f64| (drop.z(x, y) + p.allowance).max(-level);
            passes.push(raster_rows(p, p.rough_step_over_mm, &z_at));
        }
    }
    let finish = |x: f64, y: f64| drop.z(x, y);
    passes.push(raster_rows(p, p.step_over_mm, &finish));

    let mut last: Pt3 = (0.0, 0.0, 0.0);
    for rows in passes {
        let mut first = true;
        for row in rows {
            if row.is_empty() {
                continue;
            }
            let (x0, y0, z0) = row[0];
            if first {
                out.push(format!("G0 X{} Y{}", f(x0), f(y0)));
                out.push(format!("G1 Z{} F{}", f(z0), f(p.plunge_rate)));
                first = false;
            } else {
                let lift = last.2.max(z0).max(drop.z((last.0 + x0) / 2.0, (last.1 + y0) / 2.0));
                if lift > last.2 + 1e-9 {
                    out.push(format!("G1 Z{}", f(lift)));
                }
                out.push(format!("G1 X{} Y{}", f(x0), f(y0)));
                if (z0 - lift).abs() > 1e-9 {
                    out.push(format!("G1 Z{}", f(z0)));
                }
            }
            for (i, q) in row.iter().enumerate().skip(1) {
                let feed = if i == 1 { format!(" F{}", f(p.feed_rate)) } else { String::new() };
                out.push(format!("G1 X{} Y{} Z{}{}", f(q.0), f(q.1), f(q.2), feed));
            }
            last = row[row.len() - 1];
        }
        out.push(format!("G0 Z{}", f(post.safe_z)));
    }
    out.push("M5".into());
    out.extend(post.footer.iter().cloned());
    out.join("\n") + "\n"
}

#[cfg(test)]
mod tests {
    use super::*;

    fn flat_params(n: usize) -> ReliefParams {
        ReliefParams {
            nx: n,
            ny: n,
            x: 0.0,
            y: 0.0,
            width: 10.0,
            height: 10.0,
            depth: 2.0,
            tool: ReliefTool { kind: "ballnose".into(), diameter: 2.0, angle: None },
            step_over_mm: 1.0,
            rough_step_over_mm: 2.0,
            direction: "x".into(),
            roughing: false,
            step_down: 1.0,
            allowance: 0.2,
            feed_rate: 1000.0,
            plunge_rate: 300.0,
            spindle_rpm: 18000.0,
            post: Post { header: vec![], footer: vec![], decimals: 3, safe_z: 5.0, laser_dynamic_power: false },
        }
    }

    #[test]
    fn full_height_surface_stays_at_top() {
        let p = flat_params(11);
        let h = vec![1.0f32; 121];
        assert!(DropCutter::new(&h, &p).z(5.0, 5.0).abs() < 1e-9);
    }

    #[test]
    fn empty_surface_reaches_full_depth_in_the_middle() {
        let p = flat_params(11);
        let h = vec![0.0f32; 121];
        assert!((DropCutter::new(&h, &p).z(5.0, 5.0) + 2.0).abs() < 1e-9);
    }
}
