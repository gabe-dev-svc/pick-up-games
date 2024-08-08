// stateless widget representing a game as a card
import 'dart:convert';

import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:sign_ups_app/models/game.dart';
import 'package:http/http.dart' as http;

class GameWidget extends StatelessWidget {
  final Game game;

  const GameWidget({required this.game});

  String get _sportEmoji {
    final emojiDictionary = {
      "soccer": "⚽",
      "basketball": "🏀",
      "volleyball": "🏐"
    };
    final gameCategory = game.category;
    return emojiDictionary[gameCategory] ?? "⚽";
  }

  // TODO: 8 Aug 2024 - validate signup logic works
  Future<void> _signUp() async {
    const String apiHost =
        ''; // TODO: user flutter_dotenv(?) to inject environment variables
    String signUpPath = '/games/${game.gameId}/registration';
    SharedPreferences prefs = await SharedPreferences.getInstance();
    String? jwt = prefs.getString('jwt');
    try {
      final response = await http.post(
          Uri.https(apiHost, signUpPath),
          headers: {"Authorization": "Bearer $jwt"}
      );
      if (response.statusCode == 200) {
        print("ok");
      }
    } catch (error) {
      // Handle any errors that occur during the request
      print(error);
    }
  }

  @override
  // TODO: need to read through Flutter docs to better understand widget layout
  Widget build(BuildContext context) {
    return Center(
        child: Card(
            child: Padding(
      padding: const EdgeInsets.all(8.0),
      child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: <Widget>[
            Text("${game.category} ${game.teamSize} v ${game.teamSize}"),
            Text("📍 ${game.location}"),
            Text("🕑 ${game.startTime.toString()}"),
            Row(
              children: <Widget>[
                Text("💰 ${game.signupFeeCents / 100}"),
                Text("💸 ${game.splitFeeCents / 100}"),
              ],
            ),
            Row(
              children: [
                Text("Registered ${game.roster.length}"),
                Text("Waitlist ${game.waitList.length}"),
              ],
            ),
            // sign up buttons
            Row(mainAxisAlignment: MainAxisAlignment.spaceEvenly, children: [
              FilledButton(
                onPressed: _signUp,
                child: const Text('Sign Up'),
              )
            ]),
          ]),
    )));
  }
}
