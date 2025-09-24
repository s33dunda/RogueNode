"use client";

import { SignInButton, SignUpButton, UserButton } from "@clerk/nextjs";
import { Authenticated, Unauthenticated } from "convex/react";
import GameTerminal from "../components/GameTerminal";

export default function Home() {
	return (
		<>
			<Authenticated>
				<div className="flex h-screen w-full bg-black text-green-500 overflow-hidden font-mono">
					<GameTerminal />
				</div>
			</Authenticated>
			<Unauthenticated>
				<header className="sticky top-0 z-10 bg-background p-4 border-b-2 border-slate-200 dark:border-slate-800 flex flex-row justify-between items-center">
					RogueNode
					<UserButton />
				</header>
				<main className="p-8 flex flex-col gap-8">
					<h1 className="text-4xl font-bold text-center">RogueNode</h1>
					<SignInForm />
				</main>
			</Unauthenticated>
		</>
	);
}

function SignInForm() {
	return (
		<div className="flex flex-col gap-8 w-96 mx-auto">
			<p>Log in to see the numbers</p>
			<SignInButton mode="modal">
				<button
					type="button"
					className="bg-foreground text-background px-4 py-2 rounded-md"
				>
					Sign in
				</button>
			</SignInButton>
			<SignUpButton mode="modal">
				<button
					type="button"
					className="bg-foreground text-background px-4 py-2 rounded-md"
				>
					Sign up
				</button>
			</SignUpButton>
		</div>
	);
}

// function Content() {
// 	const { viewer } =
// 		useQuery(api.myFunctions.listNumbers, {
// 			count: 10,
// 		}) ?? {};

// 	if (viewer === undefined) {
// 		return (
// 			<div className="mx-auto">
// 				<p>loading... (consider a loading skeleton)</p>
// 			</div>
// 		);
// 	}
// }
