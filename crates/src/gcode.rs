use crate::geometry::Pt;
use crate::Post;

pub struct ProfileOptions {
    pub laser: bool,
    pub cut_depth: f64,
    pub step_down: f64,
    pub feed_rate: f64,
    pub plunge_rate: f64,
    pub spindle_rpm: f64,
    pub laser_s: f64,
    pub passes: u32,
}

/// Formaterar tal utan onödiga nollor, samma regler som `formatNumber` i TS.
pub fn fmt(v: f64, decimals: usize) -> String {
    let s = format!("{:.*}", decimals, v);
    let s = if s.contains('.') { s.trim_end_matches('0').trim_end_matches('.').to_string() } else { s };
    if s == "-0" { "0".into() } else { s }
}

pub fn depth_passes(total: f64, step: f64) -> Vec<f64> {
    if total <= 0.0 {
        return vec![0.0];
    }
    let s = if step > 0.0 { step } else { total };
    let n = (total / s - 1e-9).ceil() as usize;
    (1..=n).map(|i| (s * i as f64).min(total)).collect()
}

pub fn profile(polys: &[(bool, Vec<Pt>)], o: &ProfileOptions, post: &Post) -> String {
    let d = post.decimals;
    let f = |v: f64| fmt(v, d);
    let mut out: Vec<String> = Vec::new();
    out.push(format!("; desktopCAM {}", if o.laser { "laser cut" } else { "profile" }));
    out.extend(post.header.iter().cloned());
    out.push("G21".into());
    out.push("G90".into());

    let route = |closed: bool, pts: &Vec<Pt>| -> Vec<Pt> {
        let mut r: Vec<Pt> = pts[1..].to_vec();
        if closed {
            r.push(pts[0]);
        }
        r
    };

    if !o.laser {
        out.push(format!("M3 S{}", o.spindle_rpm.round() as i64));
        out.push(format!("G0 Z{}", f(post.safe_z)));
        let depths = depth_passes(o.cut_depth, o.step_down);
        for (closed, pts) in polys {
            if pts.len() < 2 {
                continue;
            }
            let r = route(*closed, pts);
            out.push(format!("G0 X{} Y{}", f(pts[0].0), f(pts[0].1)));
            for (i, depth) in depths.iter().enumerate() {
                if i > 0 && !*closed {
                    out.push(format!("G0 Z{}", f(post.safe_z)));
                    out.push(format!("G0 X{} Y{}", f(pts[0].0), f(pts[0].1)));
                }
                out.push(format!("G1 Z{} F{}", f(-depth), f(o.plunge_rate)));
                for (j, q) in r.iter().enumerate() {
                    let feed = if j == 0 { format!(" F{}", f(o.feed_rate)) } else { String::new() };
                    out.push(format!("G1 X{} Y{}{}", f(q.0), f(q.1), feed));
                }
            }
            out.push(format!("G0 Z{}", f(post.safe_z)));
        }
        out.push("M5".into());
    } else {
        out.push(format!("{} S0", if post.laser_dynamic_power { "M4" } else { "M3" }));
        for _ in 0..o.passes {
            for (closed, pts) in polys {
                if pts.len() < 2 {
                    continue;
                }
                let r = route(*closed, pts);
                out.push(format!("G0 X{} Y{} S0", f(pts[0].0), f(pts[0].1)));
                for (j, q) in r.iter().enumerate() {
                    let feed = if j == 0 { format!(" F{}", f(o.feed_rate)) } else { String::new() };
                    out.push(format!("G1 X{} Y{} S{}{}", f(q.0), f(q.1), f(o.laser_s), feed));
                }
            }
        }
        out.push("M5".into());
    }
    out.extend(post.footer.iter().cloned());
    out.join("\n") + "\n"
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn number_format_matches_typescript() {
        assert_eq!(fmt(1.5000, 3), "1.5");
        assert_eq!(fmt(-0.0001, 3), "0");
        assert_eq!(fmt(12.0, 3), "12");
    }

    #[test]
    fn depth_passes_split_evenly() {
        assert_eq!(depth_passes(6.0, 2.0), vec![2.0, 4.0, 6.0]);
        assert_eq!(depth_passes(5.0, 2.0), vec![2.0, 4.0, 5.0]);
    }
}
