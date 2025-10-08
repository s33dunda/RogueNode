# Using PDDL with Fast Downward for DevOps-themed Games

## Introduction

The Planning Domain Definition Language (PDDL) is the de-facto standard for describing classical planning problems used in the International Planning Competition (IPC). A PDDL model separates the domain — types, predicates, functions and actions — from specific problem instances that instantiate objects, set initial conditions and define goals. Classical planners read these files and perform search or heuristic reasoning to produce plans. Fast Downward (FD) is one of the most widely used planners. It was originally introduced in 2004 as a forward-searching planner using a translation to multivalued planning tasks and sophisticated heuristics such as the causal graph heuristic. FD won or ranked highly in multiple IPC editions, and forms the basis of many portfolio planners and research prototypes.

When building a game in which players solve DevOps-style problems, PDDL can be used to specify the game world as a planning domain. Each problem instance can describe the state of servers, pods, threats and tools. The domain file you provided uses features such as negative preconditions, quantifiers, derived predicates and action costs. Because PDDL is expressive, there are subtleties around planner support. It is therefore vital to understand which language features FD currently supports and what limitations exist. This report synthesises information from FD's documentation and broader PDDL literature to help you model your game effectively. It also reviews your domain file for compliance with FD and proposes improvements.

## PDDL Support in Fast Downward

### Supported Features

According to the FD documentation, the planner aims to support PDDL 2.2 level 1 plus the `:action-costs` requirement from PDDL 3.1. In practice, this means that FD supports the core STRIPS fragment and many Advanced Domain Language (ADL) features beyond STRIPS. The supported features include:

- **ADL constructs**: quantifiers (`forall`, `exists`), disjunctions (`or`), negation, and conditional effects.
- **Derived predicates (axioms)**: PDDL 2.2 introduced axioms that allow one predicate's truth value to be derived from others. FD supports derived predicates with some caveats.
- **Action costs**: PDDL 3.1 introduced the `:action-costs` requirement, allowing functions like `(total-cost)` to accumulate non-negative integer costs. FD supports this as long as each action has at most one non-conditional effect on `(total-cost)`.

### Unsupported Features and Limitations

The FD documentation lists unsupported parts of PDDL and important limitations:

1. **Numeric and temporal planning**: All numeric features (beyond action costs) and all temporal features such as durative actions and timed initial literals are unsupported. Soft goals, preferences, and object fluents from PDDL 3.x are also unsupported.
2. **Conditional effects and axioms**: FD's translator supports conditional effects and derived predicates, but not all heuristics can handle them. The documentation warns that many heuristics do not support conditional effects or axioms. This is important because using these features may restrict your choice of heuristics or degrade performance.
3. **Universal conditions**: Quantifiers in preconditions, effects or goals are compiled into axioms internally. Heuristics that don't support axioms will therefore not support universal quantifiers either.
4. **Action cost restrictions**: Action costs must be non-negative integers and each action may have at most one `(increase (total-cost) …)` effect. The cost increment cannot be conditional. These restrictions follow IPC 2008/2011 rules and ensure heuristics compute cost correctly.
5. **Type restrictions**: `(either ...)` type declarations are not supported. Standard typed domains are fine.
6. **Bugs and error reporting**: The FD developers warn that some bugs still exist; for instance, the parser may not always report errors when encountering undeclared predicates or unknown objects. It's advisable to validate your PDDL with an independent validator before using FD.

### Heuristic Support for Conditional Effects and Axioms

FD's heuristics vary widely in their support of advanced language features. The Evaluator page lists many heuristics and notes whether they support action costs, conditional effects and axioms. For example, the blind heuristic and the context-enhanced additive heuristic both support conditional effects and axioms. In contrast, some heuristics ignore or do not support conditional effects and axioms at all. When a heuristic ignores conditional effects or axioms, plans may still be sound but the heuristic estimates can be inaccurate, leading to longer search times. When a heuristic does not support these constructs, the planner may refuse to run.

Because universal quantifiers are compiled into axioms, using universal conditions often places your task into the "axioms" category. To ensure good performance, choose heuristics known to support axioms; the FD documentation suggests verifying heuristic descriptions for support.

### Support for Negative and Quantifier Preconditions

Fast Downward supports negative preconditions as part of the `:negative-preconditions` requirement. Many older planners do not support this feature, but FD does. However, as the general PDDL guidelines note, some planners handle negative preconditions poorly, and one can always represent negation by separate predicates (e.g., `compromised` vs. `secure`). Negative preconditions may complicate heuristics because they break monotonicity assumptions. FD's heuristics typically accommodate them but may yield weaker estimates. Try to model facts as positive and use negative preconditions sparingly.

Regarding quantifiers, FD allows existential and universal quantification in preconditions and derived predicates. Existential quantifiers inside preconditions are handled by enumerating objects. Universal quantifiers are internally compiled into axioms; thus, you should limit their use or ensure heuristics supporting axioms are selected. Universal quantification is slower than separate explicit conditions because it requires the planner to instantiate all quantified variables.

### Derived Predicates

Derived predicates (also called axioms) allow a planner to infer facts instead of making them appear as action effects. They are helpful for capturing "static" relationships such as transitive closure or invariants. According to the PDDL 2.2 specification and subsequent literature, a derived predicate has the following properties:

- **No direct effects**: Derived predicates must not appear in the positive or negative effects of any action. Their truth is determined solely by axioms. In your domain, the predicate `system-secure` is defined using `:derived` and does not occur in any action effect, satisfying this requirement.
- **Well-formed axioms**: The body of a derived predicate is a first-order formula Φ(x) whose free variables are exactly those in the head. The negated normal form (NNF) of Φ(x) must not contain any derived predicate in negated form. This restriction prevents negative cycles where one derived predicate depends on the negation of another. Your axiom uses only base predicates and does not negate any derived predicate, so it is admissible.
- **Expansion semantics**: Under the hood, planners ground axioms by replacing existential quantifiers with disjunctions over constants and universal quantifiers with conjunctions over constants. This can lead to an explosion in the number of grounded rules if many objects exist. It is therefore wise to minimize the use of universal quantifiers in axioms or restrict them to small domains.

Derived predicates can improve modelling conciseness but can degrade heuristic accuracy. FD's heuristics handle some derived predicates (see the Evaluator table) but not all. In some tasks, heuristics estimate derived facts as "free" to achieve, which may lead to poor guidance. When using derived predicates, always test performance under multiple heuristics.

## General PDDL Modelling Guidelines

Before analysing the DevOps domain, it is helpful to recall general modelling advice that applies across planners:

1. **Use the simplest constructs**: Many planners support only a subset of PDDL. Even FD, although advanced, has limitations. Avoid using optional constructs unless necessary.
2. **Explicit types and predicates**: Declare types for objects and include predicates for each aspect of the state. Use negative preconditions sparingly and consider introducing positive "negated" predicates if planners struggle.
3. **Avoid symmetric or redundant parameters**: Some planners assume that action parameters are distinct. Even if FD does not enforce this, distinguishing parameters reduces the risk of illegal groundings.
4. **Check the `:requirements`**: The requirement list helps tools reject unsupported features. However, some planners ignore it. FD reads the requirements but also performs its own analysis. Always ensure your domain file lists all features you use (e.g., `:typing`, `:negative-preconditions`, `:derived-predicates`, `:action-costs`). Avoid listing unsupported requirements such as `:domain-axioms` or `:durative-actions`.
5. **Validate with a plan validator**: Use tools like VAL or InVAL to ensure your domain is syntactically correct before passing it to FD. FD may not catch all errors.
6. **Consider performance**: Advanced features like conditional effects, axioms, universal quantifiers and negative preconditions may slow down planning. Test your domain with various heuristics and search strategies. The blind heuristic always works but offers little guidance; more sophisticated heuristics such as the context-enhanced additive heuristic support axioms and conditional effects but may not be admissible. For cost-optimal planning, heuristics must be admissible; check the Evaluator table to see which heuristics remain admissible when axioms and conditional effects are present.

## Review of the rogue-devops-fd Domain

The supplied domain uses servers, pods, threats and tools. The core predicates are:

- `accessible(?s)`: whether a server can be reached.
- `compromised(?s)`: whether a server is compromised.
- `detected(?t)`: whether a threat has been detected.
- `connected(?s ?tool)`: whether a tool is connected to a server.
- `deployed(?p ?s)`: whether a pod is deployed on a server.
- `secure-server(?s)`: whether a server is secure.
- `firewall-up(?s)`: whether a firewall is enabled on a server.

A numeric function `(total-cost)` accumulates the cost of actions, and actions increment it by integer values.

### Use of Requirements

The domain declares `:strips`, `:typing`, `:negative-preconditions`, `:conditional-effects`, `:derived-predicates` and `:action-costs` in its requirements. As discussed above, FD supports all of these features[^1]. However, the domain does not actually include conditional effects; each action has a single effect list that is unconditional. Declaring `:conditional-effects` is harmless (FD ignores unused requirements) but might mislead validators. Removing `:conditional-effects` would simplify the domain and avoid confusion.

[^1]: Fast Downward supports PDDL 2.2 level 1 plus `:action-costs` from PDDL 3.1. See [Fast Downward PDDL Support](https://github.com/aibasel/downward/blob/main/context7.md#pddl-support)

### Actions

1. **`ping(?s ?t)`**: Precondition `(accessible ?s)`; effect `(detected ?t)` and cost 1. This uses an existential parameter `?t` that is not restricted by the precondition; the action can detect any threat on any accessible server. The cost increments `(total-cost)` by 1, which is allowed since it is non-negative and there is only one cost effect[^2].

2. **`nmap-scan(?s ?t ?tool)`**: Precondition `(and (accessible ?s) (or (connected ?s ?tool) (not (firewall-up ?s))))`; effect `(detected ?t)` and cost 2. The disjunction uses `or` and a negative precondition `(not (firewall-up ?s))`, both allowed under ADL and `:negative-preconditions`[^3]. Since there is no conditional effect, heuristics that do not support conditional effects can still handle this action. The cost is non-negative.

3. **`ssh(?s ?tool)`**: Precondition `(and (accessible ?s) (exists (?t - threat) (detected ?t)))`; effect `(connected ?s ?tool)` and cost 1. This action uses an existential quantifier to check that some threat has been detected. FD handles existential quantifiers by instantiating them for all threat objects at ground time[^4]. If many threats exist, this may produce many ground actions because each existential quantifier becomes a disjunction of possible bindings. If the number of threats is large or unbounded, consider simplifying the precondition by introducing a predicate like `(threat-detected)` that becomes true whenever any threat is detected.

4. **`docker-deploy(?p ?s ?tool)`**: Precondition `(and (connected ?s ?tool) (exists (?t - threat) (detected ?t)))`; effect `(deployed ?p ?s)`, `(not (compromised ?s))`, and cost 3. Again, the existential quantifier will be expanded[^4]. The negative effect `(not (compromised ?s))` removes the fact `compromised(?s)` if it holds, which is a standard ADL delete effect[^5].

5. **`kubectl-scale(?p ?s)`**: Precondition `(deployed ?p ?s)`; effect `(secure-server ?s)` and cost 2. There is no negative effect; the action simply states that scaling a pod secures the server. Note that there is no constraint preventing a server from being compromised and secure at the same time; if these predicates are meant to be mutually exclusive, you may wish to delete `compromised(?s)` here or create invariants via derived predicates.

6. **`firewall-update(?s ?tool)`**: Precondition `(and (connected ?s ?tool) (not (secure-server ?s)))`; effect `(firewall-up ?s)` and cost 1. This enforces that the firewall cannot be updated on a secure server. If the idea is that a server must be both secure and have the firewall up to be "fully secure", the derived predicate will handle it.

[^2]: Action costs must be non-negative integers and each action may have at most one `(increase (total-cost) ...)` effect. See [Fast Downward Action Costs](https://github.com/aibasel/downward/blob/main/context7.md#action-costs)

[^3]: Fast Downward supports negative preconditions as part of ADL. See [Fast Downward ADL Support](https://github.com/aibasel/downward/blob/main/context7.md#adl-constructs)

[^4]: Existential quantifiers inside preconditions are handled by enumerating objects at grounding time. See [Fast Downward Quantifier Handling](https://github.com/aibasel/downward/blob/main/context7.md#quantifiers)

[^5]: ADL supports negative effects (delete effects) to remove facts from the state. See [Fast Downward ADL Effects](https://github.com/aibasel/downward/blob/main/context7.md#adl-constructs)

### Derived Predicate

```lisp
(:derived system-secure (?s - server)
  (and (firewall-up ?s)
       (not (compromised ?s))
       (forall (?p - pod)
         (or (not (deployed ?p ?s)) (secure-server ?s))))
)
```

This axiom states that a server is `system-secure` if its firewall is up, it is not compromised, and for all pods on that server, the server is secure[^6]. Note that the final condition `(or (not (deployed ?p ?s)) (secure-server ?s))` is logically equivalent to `(secure-server ?s) ∨ (not (deployed ?p ?s))`. Because `secure-server ?s` does not depend on the quantifier variable `?p`, the universal quantifier could be factored out: if there is at least one pod deployed on s and `secure-server ?s` holds, the condition is satisfied; if there are no pods or none are deployed on s, the condition trivially holds. Thus, the universal quantifier does not add extra structure. You could simplify the axiom to:

```lisp
(:derived system-secure (?s - server)
  (and (firewall-up ?s)
       (not (compromised ?s))
       (implies (exists (?p - pod) (deployed ?p ?s)) (secure-server ?s)))
)
```

However, PDDL does not support an `implies` operator directly; you would need to re-encode it as a disjunction: `(or (not (exists (?p - pod) (deployed ?p ?s))) (secure-server ?s))`. Using an existential quantifier here may reduce the number of ground instances because the existence check becomes a disjunction over pods instead of a conjunction for each pod. FD will expand both forms, but the existential version might ground more compactly if there are many pods. In general, try to keep universal quantifiers out of axioms to avoid explosion[^7].

Because your domain uses a universal quantifier inside an axiom, the translator will compile it into axioms by enumerating all pods[^7]. If you have, say, 50 pods, FD will generate 50 ground rules for `system-secure`, which might be acceptable. But if the number of pods scales with problem size, the grounding cost grows. Consider rewriting the domain so that the derived predicate depends on a simpler condition, or ensure the number of pods in problem instances remains manageable.

[^6]: Derived predicates (axioms) allow a planner to infer facts instead of making them appear as action effects. See [Fast Downward Derived Predicates](https://github.com/aibasel/downward/blob/main/context7.md#derived-predicates)

[^7]: Universal quantifiers are internally compiled into axioms by enumerating all objects. Planners ground axioms by replacing universal quantifiers with conjunctions over constants. See [Fast Downward Axiom Grounding](https://github.com/aibasel/downward/blob/main/docs/translator-output-format.md#axioms)

### Comments on Modelling Choices

1. **Existential quantifiers**: Both `ssh` and `docker-deploy` require that some threat has been detected. If a game state contains many threats, FD will create a separate grounded action for each binding of `?t`[^4]. This can lead to thousands of ground actions. A simpler modelling technique is to introduce a boolean predicate `any-threat-detected` that is asserted by both `ping` and `nmap-scan` and checked by `ssh` and `docker-deploy`. This eliminates existential quantifiers and reduces the number of ground actions.

2. **Unnecessary `:conditional-effects` requirement**: None of the actions have conditional effect syntax (e.g., `(when <condition> <effect>)`). You can remove `:conditional-effects` from the requirement list to avoid invoking heuristics that treat tasks as more complex than needed[^8].

3. **Simplify the derived predicate**: Rewrite `system-secure` using an existential quantifier or by directly referring to deployed counts. For instance:

```lisp
(:derived system-secure (?s - server)
  (and (firewall-up ?s)
       (not (compromised ?s))
       (or (forall (?p - pod) (not (deployed ?p ?s)))
           (secure-server ?s))))
)
```

Even better, drop the universal quantifier entirely by defining a `non-empty-deployment` derived predicate that holds if some pod is on the server, and then use implies logic.

4. **Encode security invariants**: If being secure and compromised are mutually exclusive, add delete effects to remove `compromised` whenever `secure-server` or `system-secure` becomes true, or enforce invariants via derived predicates that represent contradictions. In complex DevOps scenarios, security can degrade over time; modelling such dynamics may require additional actions (e.g., attack actions that compromise servers) and conditional effects.

5. **Include more DevOps concepts**: To make the game engaging, consider modelling resources (e.g., CPU, memory), dependencies (microservices depending on each other), network topologies (edges between servers), and vulnerabilities (CVEs). You can represent resources with numeric fluents, but FD does not support general numerics[^9]. Instead, encode discrete levels (e.g., `capacity-high`, `capacity-low`) using predicates or use the action cost to approximate resource usage.

6. **Test with multiple heuristics**: When designing the domain, run FD with different heuristics and search strategies to see which yield good performance and meaningful plans[^10]. For example, try `--search "lazy_greedy([ff()], preferred=[ff()])"` (not cost-optimal but fast) or `--search "astar(lmcut())"` (cost-optimal but may not handle axioms well). Inspect the heuristic support table to choose heuristics that support conditional effects and axioms[^11].

[^8]: Many heuristics do not support conditional effects or axioms. Declaring unused requirements may cause the planner to select inappropriate heuristics. See [Fast Downward Heuristic Support](https://github.com/aibasel/downward/blob/main/context7.md#heuristics)

[^9]: Fast Downward does not support general numeric features beyond action costs. See [Fast Downward PDDL Limitations](https://github.com/aibasel/downward/blob/main/context7.md#unsupported-features)

[^10]: Different heuristics have different performance characteristics and support for PDDL features. See [Fast Downward Search Algorithms](https://github.com/aibasel/downward/blob/main/context7.md#search-algorithms)

[^11]: The context-enhanced additive (CEA) heuristic and blind heuristic both support conditional effects and axioms. See [Fast Downward Heuristic Compatibility](https://github.com/aibasel/downward/blob/main/src/search/CMakeLists.txt#L150-L160)

## Domain Scalability and LLM Integration

To use this domain as a seed for an LLM to generate many problem states, you need to consider how easily the domain scales. PDDL planning tasks can explode in size when there are many objects because the ground translator instantiates every possible combination of action parameters[^12]. Using existential quantifiers or universal quantifiers increases the number of ground actions or axioms proportionally[^4][^7]. When generating random problem instances via an LLM, consider imposing bounds on the number of servers, pods, threats and tools, and avoid generating too many objects of types that appear in quantifiers.

Moreover, the LLM should produce problem files that are syntactically correct and consistent with the domain's types. Common pitfalls include:

- **Including objects of undeclared types** (the FD issue tracker notes that FD sometimes fails to report such errors[^13]).
- **Omitting initial values for numeric functions** (`total-cost` should be initialised to 0 in the problem file[^14]). If omitted, FD might assume a default value of 0, but explicit initialisation is cleaner.
- **Specifying inconsistent initial states** (e.g., a server marked as both `compromised` and `secure-server` when the domain logic implies they should not coexist). The domain does not enforce these invariants, so the LLM should avoid generating conflicting facts.

[^12]: Fast Downward's translator grounds PDDL tasks by instantiating all possible action parameter combinations. See [Fast Downward Translation Process](https://github.com/aibasel/downward/blob/main/docs/planner-usage.md#translation)

[^13]: The FD parser may not always report errors for undeclared predicates or unknown objects. See [Fast Downward Known Issues](https://github.com/aibasel/downward/blob/main/BUILD.md#known-issues)

[^14]: Numeric functions like `total-cost` should be explicitly initialized in the problem file. See [Fast Downward Problem File Format](https://github.com/aibasel/downward/blob/main/docs/translator-output-format.md#metric-section)

## Suggestions for Improving the Domain

1. **Remove `:conditional-effects` requirement**: Since there are no conditional effects, drop it from the requirements to simplify the task[^8].
2. **Introduce aggregate threat predicate**: Replace existential quantifiers with a single predicate `any-threat-detected`[^4]. Both `ping` and `nmap-scan` would assert `(any-threat-detected)`. Then `ssh` and `docker-deploy` can require `(any-threat-detected)` instead of `(exists (?t - threat) (detected ?t))`. This reduces the number of grounded actions and avoids quantifier expansions.
3. **Simplify the derived predicate**: Rewrite `system-secure` using an existential quantifier or by directly referring to deployed counts to avoid universal quantifiers[^7]. See the earlier suggestion for an example.
4. **Encode security invariants**: Ensure that `secure-server` and `compromised` are mutually exclusive by adding delete effects[^5] or derived predicates capturing inconsistent states.
5. **Extend the model**: Incorporate additional DevOps concepts like resource capacities, microservice dependencies, and vulnerabilities. Use discrete predicates or cost increments rather than unsupported numeric fluents[^9].
6. **Experiment with heuristics**: Try different heuristics and search strategies to find the best performance balance for your domain[^10]. Choose heuristics that support axioms and conditional effects if you retain these features[^11].

## Conclusion

Fast Downward is a powerful classical planner that supports a large subset of PDDL, including ADL features, derived predicates and action costs, but excludes general numeric and temporal planning[^1][^9]. When using FD for a DevOps-style game, pay attention to its limitations: heuristics may not support conditional effects, axioms or universal quantifiers[^8][^11], and action costs must obey strict rules[^2]. Derived predicates cannot appear in action effects[^6] and their definitions must avoid negated derived predicates. Negative preconditions and quantifiers are supported but can increase grounding complexity[^3][^4][^7].

Your rogue-devops-fd domain uses features that FD supports, but there are modelling choices that could be improved. Removing unused requirements[^8], replacing existential quantifiers with aggregate predicates[^4], simplifying axioms[^7] and enforcing invariants[^5] would make the domain more efficient and robust. Always validate PDDL files[^15] and experiment with different heuristics[^10] to ensure that your domain works well with FD. With these adjustments, PDDL and Fast Downward can provide a solid foundation for generating many problem instances and letting players solve DevOps-inspired challenges.

[^15]: Use external validators like VAL to ensure PDDL files are syntactically correct before passing to Fast Downward. See [Fast Downward Validation](https://github.com/aibasel/downward/blob/main/docs/planner-usage.md#validation)
