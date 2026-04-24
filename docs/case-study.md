# AdCraft AI Case Study

## Overview

AdCraft AI is a web app that critiques ad creatives and landing hero visuals from a conversion perspective.

The project deliberately focuses on analysis, not generation. That choice makes the product more grounded and more relevant to real design and marketing workflows.

## Problem

Many creatives look polished but still underperform because key conversion principles are weak:

- the CTA does not stand out
- the hierarchy is noisy
- contrast hurts readability
- the layout feels crowded
- the page does not build enough trust

Feedback on these issues is usually subjective, slow, or vague.

## Goal

Build one focused product that combines:

- design thinking
- frontend execution
- backend architecture
- applied AI

The objective was not to chase novelty. It was to build something that feels believable, useful, and well-scoped.

## Product decisions

### Analysis over generation

I did not want to build another AI image generator.

The stronger product opportunity was a critique tool that helps users understand what is weak, why it matters, and how to improve it.

### Hybrid scoring

A pure model-based critique can sound smart while staying generic.

To avoid that, the backend first computes deterministic visual metrics and only then optionally adds model refinement. This creates a more grounded system.

### Structured outputs

The UI only consumes typed JSON. Raw model prose never goes directly to the frontend.

That improves consistency, trust, and render quality.

### Visual overlays

Design critique is easier to act on when the user can see where the issue lives. Annotation boxes make the feedback easier to scan and apply.

## What the project demonstrates

- product framing
- pragmatic MVP scoping
- a clean frontend/backend split
- typed API contracts
- image-processing heuristics
- fallback-aware AI integration
- polished presentation

## Scope discipline

This MVP intentionally excludes:

- auth
- billing
- analytics dashboards
- batch uploads
- image generation

That keeps the project focused on the part that actually proves depth.

## Reflection

The main lesson is that technical depth is not just about adding more systems. It is about making strong decisions:

- what the product should do
- what it should not do
- where AI helps
- where deterministic logic should stay in control

AdCraft AI is strong because it feels coherent. The product concept, interface, and architecture all reinforce the same idea.
