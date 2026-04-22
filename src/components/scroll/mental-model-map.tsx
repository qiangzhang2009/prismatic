'use client';

/**
 * Mental Model Map — Minimalist D3 force-directed graph
 * Design: clean nodes, subtle connections, elegant tooltips
 */
import { useEffect, useRef } from 'react';
import { motion } from 'framer-motion';
import type { Persona } from '@/lib/types';
import type { PersonaScrollTheme } from '@/lib/persona-scroll-themes';

interface Props {
  persona: Persona;
  theme: PersonaScrollTheme;
}

export function MentalModelMap({ persona, theme }: Props) {
  const svgRef = useRef<SVGSVGElement>(null);

  useEffect(() => {
    if (!svgRef.current) return;

    let cancelled = false;
    let simulation: any;

    (async () => {
      try {
        const d3 = await import('d3');
        if (cancelled || !svgRef.current) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll('*').remove();

        const container = svgRef.current;
        const width = container.clientWidth || 900;
        const height = 520;

        svg.attr('viewBox', `0 0 ${width} ${height}`);

        const models = persona.mentalModels.slice(0, 12);
        if (models.length === 0) return;

        interface Node extends d3.SimulationNodeDatum {
          id: string;
          nameZh: string;
          oneLiner: string;
          group: number;
        }

        const nodes: Node[] = models.map((m, i) => ({
          id: m.id,
          nameZh: m.nameZh,
          oneLiner: m.oneLiner,
          group: i % 3,
        }));

        const links: { source: string; target: string }[] = [];
        for (let i = 0; i < nodes.length; i++) {
          const numLinks = Math.random() > 0.5 ? 1 : 2;
          for (let t = 0; t < numLinks; t++) {
            const j = (i + t + 1) % nodes.length;
            links.push({ source: nodes[i].id, target: nodes[j].id });
          }
        }

        simulation = d3.forceSimulation(nodes)
          .force('link', (d3.forceLink(links) as any).id((d: Node) => d.id).distance(140).strength(0.3))
          .force('charge', d3.forceManyBody().strength(-200))
          .force('center', d3.forceCenter(width / 2, height / 2))
          .force('collision', d3.forceCollide().radius(65));

        const g = svg.append('g');

        // Background grid dots
        const dotSpacing = 40;
        for (let x = dotSpacing; x < width; x += dotSpacing) {
          for (let y = dotSpacing; y < height; y += dotSpacing) {
            g.append('circle')
              .attr('cx', x).attr('cy', y).attr('r', 0.75)
              .attr('fill', theme.primaryColor)
              .attr('opacity', 0.06);
          }
        }

        const link = g.append('g')
          .selectAll('line')
          .data(links)
          .join('line')
          .attr('stroke', theme.primaryColor)
          .attr('stroke-opacity', 0.12)
          .attr('stroke-width', 1);

        const node = g.append('g')
          .selectAll<SVGGElement, Node>('g')
          .data(nodes)
          .join('g')
          .style('cursor', 'default');

        node.append('circle')
          .attr('r', 40)
          .attr('fill', 'none')
          .attr('stroke', theme.primaryColor)
          .attr('stroke-width', 0.5)
          .attr('stroke-opacity', 0.1);

        node.append('circle')
          .attr('r', 32)
          .attr('fill', `${theme.primaryColor}0c`)
          .attr('stroke', theme.primaryColor)
          .attr('stroke-width', 1)
          .attr('stroke-opacity', 0.4);

        node.append('circle')
          .attr('r', 5)
          .attr('fill', theme.primaryColor)
          .attr('opacity', 0.6);

        node.append('text')
          .text((d) => d.nameZh.length > 6 ? d.nameZh.slice(0, 5) + '…' : d.nameZh)
          .attr('text-anchor', 'middle')
          .attr('dy', '3.5em')
          .attr('fill', '#94a3b8')
          .attr('font-size', '10px')
          .attr('font-family', 'system-ui, sans-serif')
          .attr('pointer-events', 'none');

        // Tooltip
        const tipDiv = document.createElement('div');
        tipDiv.style.cssText = [
          'position:fixed',
          'pointer-events:none',
          'z-index:9999',
          'opacity:0',
          'transition:opacity 0.15s',
          `background:${theme.primaryColor}12`,
          `border:1px solid ${theme.primaryColor}30`,
          'color:#e2e8f0',
          'padding:10px 14px',
          'border-radius:8px',
          'font-size:12px',
          'max-width:220px',
          'line-height:1.5',
          'display:none',
          'backdrop-filter:blur(8px)',
          'font-family:system-ui,sans-serif',
        ].join(';');
        document.body.appendChild(tipDiv);

        node.on('mouseenter', function(event, d) {
          tipDiv.style.opacity = '1';
          tipDiv.style.left = (event.clientX + 14) + 'px';
          tipDiv.style.top = (event.clientY - 10) + 'px';
          tipDiv.style.display = 'block';
          tipDiv.innerHTML = `<strong style="color:${theme.primaryColor};font-size:13px">${d.nameZh}</strong><br/><span style="opacity:0.6;font-size:11px">${d.oneLiner}</span>`;
          d3.select(this).select('circle:nth-child(2)').attr('fill', `${theme.primaryColor}22`);
        }).on('mouseleave', function() {
          tipDiv.style.opacity = '0';
          tipDiv.style.display = 'none';
          d3.select(this).select('circle:nth-child(2)').attr('fill', `${theme.primaryColor}0c`);
        });

        const zoom = d3.zoom<SVGSVGElement, unknown>()
          .scaleExtent([0.4, 2])
          .on('zoom', (event) => g.attr('transform', event.transform));
        svg.call(zoom);

        node.style('opacity', 0)
          .transition()
          .delay((_: unknown, i: number) => i * 60)
          .duration(500)
          .style('opacity', 1);

        simulation.on('tick', () => {
          link
            .attr('x1', (d: any) => (d?.source as any)?.x ?? 0)
            .attr('y1', (d: any) => (d?.source as any)?.y ?? 0)
            .attr('x2', (d: any) => (d?.target as any)?.x ?? 0)
            .attr('y2', (d: any) => (d?.target as any)?.y ?? 0);
          node.attr('transform', (d: any) => `translate(${d?.x ?? 0},${d?.y ?? 0})`);
        });

      } catch (err) {
        // Suppress D3 version conflicts (d3-force v3 vs d3-delaunay v6) and other rendering errors
        console.warn('[MentalModelMap] D3 error suppressed:', err);
      }
    })();

    return () => {
      cancelled = true;
      if (simulation) simulation.stop();
    };
  }, [persona.slug, persona.mentalModels, theme.primaryColor]);

  return (
    <section
      className="relative px-6 py-28"
      style={{ borderTop: `1px solid ${theme.primaryColor}15` }}
    >
      <div className="flex items-center gap-4 mb-6 max-w-5xl mx-auto">
        <div className="h-px flex-1" style={{ background: `linear-gradient(to right, transparent, ${theme.primaryColor}30)` }} />
        <span
          className="text-xs tracking-widest uppercase font-medium px-4 py-1 rounded-full"
          style={{
            color: theme.primaryColor,
            background: `${theme.primaryColor}08`,
            border: `1px solid ${theme.primaryColor}20`,
            letterSpacing: '0.2em',
          }}
        >
          心智模型
        </span>
        <div className="h-px flex-1" style={{ background: `linear-gradient(to left, transparent, ${theme.primaryColor}30)` }} />
      </div>

      <div className="max-w-5xl mx-auto">
        <motion.p
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          className="text-center text-xs mb-6"
          style={{ color: theme.primaryColor, opacity: 0.3 }}
        >
          滚轮缩放 · 鼠标悬停查看详情
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.7 }}
          className="w-full rounded-2xl overflow-hidden"
          style={{
            background: `${theme.primaryColor}05`,
            border: `1px solid ${theme.primaryColor}18`,
            height: '520px',
          }}
        >
          <svg
            ref={svgRef}
            className="w-full h-full"
            style={{ display: 'block' }}
          />
        </motion.div>
      </div>
    </section>
  );
}
