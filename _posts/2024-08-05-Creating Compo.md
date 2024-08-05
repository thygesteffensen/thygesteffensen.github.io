---
title: "Compo - Compositional Function evaluator"
author: "Thyge S. Steffensen"
layout: post1
tags: ["PAMU", "Power Automate", "Compo"]
---

# Compo - Compositional Function evaluator

Compo is the second try to implement Power Automate Expressions. This first one is [ExpressionEngine](https://github.com/delegateas/ExpressionEngine), writing in C# using Sprache.NET. The biggest flaw with Expression Engine is the `ValueContainer` and it evalating expression while parsing - which makes it harder to generate an AST and do type checking, analyzes and more.

Instead of trying to rewrite it all, I though of starting over. Compo should be exstensible, support scopes, aliases and maybe more - but firstmost it should help me make [PAMU](https://github.com/thygesteffensen/PowerAutomateMockUp) better and more reachable. But first, I want to get rid of `ValueContainer` so it is easier to Mock other Connections (i.e. group of actins and triggers).

## Getting started

Compo uses Pidgin, which like Sprache.NET, is a Parser Combinator library, that can be used to build parsers.

I want to build an AST from the input expression, which should be evaluated.

---

I actually started the project a while back, for another reason - and the process was not as interesting as one could think ... at least not to write about.

The project is pretty straight forward:

* Build the AST
* Type check (_interesting topic not yet implemented_)
* Evaluation the expression

### Evaluation

This is a bit more tricky, since I want to use CLR object instead of `ValueContainer`, mostly to make it easier to understand and work with, using the types otherwise present when during C#.

I took inspiration from another open-source code base, but I cannot remember which one. The idea is that any function implementation must implement one of the `IFunction` interfaces, each having a return type `TR` and input types being `T1`, `[T1, T2]`, `[T1, T2, T3]` or `params T`. This should cover most, if not all, functions needed to be implemented.

Then a function implementation of `abs` looking like:
```cs
[FunctionRegistration("abs")]
public class AbsFunction : IFunction<double, int>
{
    public int Execute(double t) => (int)System.Math.Abs(t);
}
```

of course with the function name being an attribute, which can be used multiple times for new function names.

This present one problem, consider the `add` function:

```cs
[FunctionRegistration("abs")]
public class AbsFunction : IFunction<double, double, double>
{
    public int Execute(double l, double r) => l + r;
}
```
This is the implementation for double, but what about `1 + 1`, or `1.1 + 1`, or any of the many other combinations?

I haven't figured that one out yet, but hopefully it won't be to big a problem. The current work around is to use `Convert.ChangeType` which works with any object implementing the `IConvertible` interface, which all primitive types does.

Then the next problem is to find the implemented function, which have the best fit - i.e. the least amount of information will be lost when converting types.

_Disclaimer: If this project should be used for critical calculations with custom functions, then all type combinations should be convered to avoid "auto" conversion - let's see how this pans out._

Evaluating the expression is as easy as walking the tree, where each node can either be a:
* ValueNode, being a terminal
* FunctionNode, being a function name and a list of Nodes
* AccessNode, being two Node, where the lhs must be either a object or list and rhs a terminal*
* 