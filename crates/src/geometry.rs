pub type Pt = (f64, f64);

pub fn signed_area(p: &[Pt]) -> f64 {
    let n = p.len();
    let mut a = 0.0;
    for i in 0..n {
        let (x1, y1) = p[i];
        let (x2, y2) = p[(i + 1) % n];
        a += x1 * y2 - x2 * y1;
    }
    a * 0.5
}

/// Miter-offset av sluten polygon. Positivt `d` = utåt.
/// TODO: byt till Clipper2 (clipper2-rust) för konkava former och självkorsningar.
pub fn offset_polygon(p: &[Pt], d: f64) -> Vec<Pt> {
    let n = p.len();
    if n < 3 || d.abs() < 1e-12 {
        return p.to_vec();
    }
    let s = if signed_area(p) >= 0.0 { 1.0 } else { -1.0 };
    let normal = |a: Pt, b: Pt| -> Pt {
        let (dx, dy) = (b.0 - a.0, b.1 - a.1);
        let l = (dx * dx + dy * dy).sqrt().max(1e-12);
        (s * dy / l, -s * dx / l)
    };
    (0..n)
        .map(|i| {
            let prev = p[(i + n - 1) % n];
            let cur = p[i];
            let next = p[(i + 1) % n];
            let n1 = normal(prev, cur);
            let n2 = normal(cur, next);
            let (bx, by) = (n1.0 + n2.0, n1.1 + n2.1);
            let bl = (bx * bx + by * by).sqrt();
            let u = if bl < 1e-9 { n1 } else { (bx / bl, by / bl) };
            let cos_half = (u.0 * n1.0 + u.1 * n1.1).max(0.25);
            let k = d / cos_half;
            (cur.0 + u.0 * k, cur.1 + u.1 * k)
        })
        .collect()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn square_offset_outward() {
        let sq = vec![(0.0, 0.0), (10.0, 0.0), (10.0, 10.0), (0.0, 10.0)];
        let o = offset_polygon(&sq, 1.0);
        assert!((o[0].0 + 1.0).abs() < 1e-9 && (o[0].1 + 1.0).abs() < 1e-9);
        assert!((o[2].0 - 11.0).abs() < 1e-9 && (o[2].1 - 11.0).abs() < 1e-9);
    }

    #[test]
    fn clockwise_square_offset_is_also_outward() {
        let sq = vec![(0.0, 0.0), (0.0, 10.0), (10.0, 10.0), (10.0, 0.0)];
        let o = offset_polygon(&sq, 1.0);
        assert!((o[0].0 + 1.0).abs() < 1e-9);
    }
}
