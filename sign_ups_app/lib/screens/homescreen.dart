import 'dart:convert';
import 'package:sign_ups_app/widgets/gamewidget.dart';
import 'package:flutter/material.dart';
import 'package:sign_ups_app/models/game.dart';
import 'package:sign_ups_app/models/gamelist.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:http/http.dart' as http;

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  _HomeScreenState createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  List<Game> _games = List.empty();

  Future<void> _getGameList() async {
    SharedPreferences prefs = await SharedPreferences.getInstance();
    String? jwt = prefs.getString('jwt');
    const String apiHost =
        ''; // TODO: user flutter_dotenv(?) to inject environment variables
    const String getGamesPath = '/games';
    try {
      final response = await http.get(
          Uri.https(apiHost, getGamesPath, {"category": "soccer"}),
          headers: {"Authorization": "Bearer $jwt"});

      if (response.statusCode == 200) {
        final responseData = json.decode(response.body);
        final gamesList = GameList.fromJson(responseData);
        setState(() {
          _games = gamesList.games;
        });
      }
    } catch (error) {
      // Handle any errors that occur during the request
      print(error);
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(content: Text('Error: $error')),
      );
    }
  }

  @override
  void initState() {
    super.initState();
    _getGameList();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Home'),
      ),
      body: Center(
          child: Row(
        children: _games
            .map((game) => GameWidget(
                  game: game,
                ))
            .toList(),
      )),
    );
  }
}
