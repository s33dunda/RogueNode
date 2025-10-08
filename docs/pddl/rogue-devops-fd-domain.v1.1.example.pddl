(define (domain rogue-devops-fd)
  (:requirements :strips :typing :negative-preconditions :derived-predicates :action-costs)

  (:types
    server pod threat tool - object
  )

  (:predicates
    (accessible ?s - server)
    (compromised ?s - server)
    (detected ?t - threat)
    (any-threat)
    (connected ?s - server ?tool - tool)
    (deployed ?p - pod ?s - server)
    (secure-server ?s - server)
  )

  (:functions
    (total-cost)
  )

  (:action ping
    :parameters (?s - server ?t - threat)
    :precondition (accessible ?s)
    :effect (and (detected ?t)
      (any-threat)
      (increase (total-cost) 1))
  )

  (:action nmap-scan
    :parameters (?s - server ?t - threat ?tool - tool)
    :precondition (and (accessible ?s)
      (or (connected ?s ?tool)))
    :effect (and (detected ?t)
      (any-threat)
      (increase (total-cost) 2))
  )

  (:action ssh
    :parameters (?s - server ?tool - tool)
    :precondition (and (accessible ?s)
      (any-threat))
    :effect (and (connected ?s ?tool)
      (increase (total-cost) 1))
  )

  (:action docker-deploy
    :parameters (?p - pod ?s - server ?tool - tool)
    :precondition (and (connected ?s ?tool)
      (any-threat))
    :effect (and (deployed ?p ?s)
      (not (compromised ?s))
      (increase (total-cost) 3))
  )

  (:action kubectl-scale
    :parameters (?p - pod ?s - server)
    :precondition (deployed ?p ?s)
    :effect (and (secure-server ?s)
      (not (compromised ?s))
      (increase (total-cost) 2))
  )

  (:derived has-deployed-pod
    (?s - server)
    (exists (?p - pod) (deployed ?p ?s))
  )

  (:derived solved
    (?s - server)
      (not (compromised ?s))
      (or (not (has-deployed-pod ?s)) (secure-server ?s))
  )
)